import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';
import { checkInQueue } from '../utils/checkInQueue';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { InputSwitch } from 'primereact/inputswitch';
import { Tag } from 'primereact/tag';
import { Dropdown } from 'primereact/dropdown';
import { IconField } from 'primereact/iconfield';
import 'primeicons/primeicons.css';
import { InputIcon } from 'primereact/inputicon';
import { FilterMatchMode } from 'primereact/api';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import io from 'socket.io-client';

// Check-in Dialog Component
function CheckInDialog({ visible, onHide, onCheckIn }) {
    const [uuid, setUuid] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (uuid.trim()) {
            onCheckIn(uuid.trim());
            setUuid('');
            onHide();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    return (
        <Dialog 
            visible={visible} 
            onHide={onHide}
            header="Manual Check-in Guest"
            modal
            className="w-full max-w-lg"
        >
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-col gap-2">
                    <label htmlFor="uuid">Enter Guest UUID</label>
                    <InputText
                        id="uuid"
                        value={uuid} 
                        onChange={(e) => setUuid(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Enter UUID here"
                        className="w-full p-2"
                        autoFocus
                    />
                </div>
                <Button 
                    label="Check In" 
                    onClick={handleSubmit}
                    className="p-button-primary"
                />
            </div>
        </Dialog>
    );
}

function AdminPage() {
    const toast = useRef(null);
    const [checkInDialogVisible, setCheckInDialogVisible] = useState(false);
    const [guests, setGuests] = useState([]);
    const [statuses] = useState(['TRUE', 'FALSE']);
    const [globalFilterValue, setGlobalFilterValue] = useState('');
    const [activeActionRow, setActiveActionRow] = useState(null); // เก็บ uuid ของ row ที่แสดงปุ่ม actions
    const [editingRows, setEditingRows] = useState({}); // เก็บ rows ที่กำลัง edit อยู่
    const [editingData, setEditingData] = useState({}); // เก็บข้อมูลที่กำลังแก้ไข
    const editingDataRef = useRef({}); // เก็บข้อมูลแบบไม่หายเมื่อ re-render
    const [filters, setFilters] = useState({
        global: { value: null, matchMode: FilterMatchMode.CONTAINS },
        name: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
        company: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
        phone: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
        checked_in: { value: null, matchMode: FilterMatchMode.EQUALS },
        allergies: { value: null, matchMode: FilterMatchMode.CONTAINS },
        Food: { value: null, matchMode: FilterMatchMode.CONTAINS },
        Position: { value: null, matchMode: FilterMatchMode.CONTAINS },
        remark: { value: null, matchMode: FilterMatchMode.CONTAINS }
    });
    const [stats, setStats] = useState({
        total: 0,
        checkedIn: 0
    });
    const [foodStats, setFoodStats] = useState({
        salmon: 0
    });
    const [newGuest, setNewGuest] = useState({
        name: '',
        email: '',
        company: '',
        phone: '',
        allergies: '',
        food: '',
        position: '',
        remark: ''
    });
    const [error, setError] = useState('');
    const [tableKey, setTableKey] = useState(0); // เพิ่ม key สำหรับ force re-render
    const [salmonBlockKey, setSalmonBlockKey] = useState(0); // Key สำหรับ force re-render salmon block
    const [scanListening, setScanListening] = useState(false); // สถานะการ listen scan
    const socketRef = useRef(null); // เก็บ socket connection reference
    const scanTimeoutRef = useRef(null); // เก็บ timeout reference สำหรับ scan buffer
    const scanBufferRef = useRef(''); // เก็บ scan buffer แบบ ref แทน state
    const isUpdatingRef = useRef(false); // ป้องกัน toast ซ้ำจาก socket เมื่อเราเป็นคนอัพเดต

    // Force update table เฉพาะเมื่อจำเป็น
    const forceUpdateTable = () => {
        setTableKey(prev => prev + 1);
    };

    // Force update salmon block
    const forceUpdateSalmonBlock = () => {
        setSalmonBlockKey(prev => prev + 1);
    };

//#region // ฟังก์ชันสำหรับจัดการการกรอง global filter 
    const onGlobalFilterChange = (e) => {
        const value = e.target.value;
        let _filters = { ...filters };

        _filters['global'].value = value;

        setFilters(_filters);
        setGlobalFilterValue(value);
    };


    const renderHeader = () => {
        return (
            <div className="flex justify-content-end">
                <IconField iconPosition="left">
                    <InputIcon className="pi pi-search" />
                    <InputText value={globalFilterValue} onChange={onGlobalFilterChange} placeholder="Keyword Search" />
                </IconField>
            </div>
        );
    };
//#endregion


//#region // Component to get severity based on checked_in value
// ==============================================================
    const getSeverity = (value) => {
        switch (value) {
            case 'TRUE':
                return 'success';

            case 'FALSE':
                return 'danger';

            default:
                return null;
        }
    };

    // คำนวณจำนวน Salmon ที่เลือก
    const calculateFoodStats = (guestList) => {
        const salmonCount = guestList?.filter(guest => {
            const food = (guest.Food || '').toLowerCase();
            return food === 'salmon';
        }).length || 0;
        
        const newFoodStats = { salmon: salmonCount };
        setFoodStats(newFoodStats);
        
        // Force update salmon block
        forceUpdateSalmonBlock();
        
        return newFoodStats;
    };
    const statusBodyTemplate = (rowData) => {
        return <Tag value={rowData.checked_in} severity={getSeverity(rowData.checked_in)}></Tag>;
    };
// ==============================================================
//#endregion

// Component to edit table data
// ==============================================================
    const onRowEditComplete = async (e) => {
    try {
        console.log('=== Row Edit Complete ===');
        console.log('Updating guest:', e.newData);
        console.log('UUID:', e.newData.uuid);
        
        // หาข้อมูลเดิมจาก guests state
        const originalGuest = guests.find(guest => guest.uuid === e.newData.uuid);
        console.log('Original guest from state:', originalGuest);
        
        // ใช้ข้อมูลจาก editingDataRef เป็นหลัก
        const editedData = editingDataRef.current[e.newData.uuid];
        console.log('Edited data from ref:', editedData);
        
        console.log('=== DEBUGGING COMPARISON ===');
        console.log('e.newData:', e.newData);
        console.log('originalGuest:', originalGuest);
        console.log('editedData:', editedData);
        
        const updateData = {};
        
        // **บังคับอัพเดตถ้ามีข้อมูลใน editingDataRef ก่อน (เพราะนี่คือการเปลี่ยนแปลงจริงๆ)**
        if (editedData) {
            console.log('*** FORCING UPDATE FROM EDITED DATA ***');
            
            if (editedData.checked_in !== undefined) {
                updateData.checked_in = editedData.checked_in;
                console.log('Forced checked_in update to:', editedData.checked_in);
            }
            
            if (editedData.Food !== undefined) {
                updateData.Food = editedData.Food;
                console.log('Forced Food update to:', editedData.Food);
            }
        }
        
        // ถ้าไม่มีใน editedData ให้ตรวจสอบการเปลี่ยนแปลงปกติ
        if (Object.keys(updateData).length === 0 && originalGuest) {
            console.log('*** CHECKING NORMAL CHANGES ***');
            
            // ตรวจสอบ checked_in
            if (e.newData.checked_in !== originalGuest.checked_in) {
                updateData.checked_in = e.newData.checked_in;
                console.log('Status changed to:', e.newData.checked_in);
            }
            
            // ตรวจสอบ Food
            const newFood = (e.newData.Food || '').toString();
            const originalFood = (originalGuest.Food || '').toString();
            console.log('Food comparison - new:', newFood, 'original:', originalFood);
            
            if (newFood !== originalFood) {
                updateData.Food = e.newData.Food;
                console.log('Food changed from:', originalFood, 'to:', newFood);
            }
        }
        
        console.log('Final update data to send:', updateData);
        
        // ถ้าไม่มีอะไรให้อัพเดต
        if (Object.keys(updateData).length === 0) {
            console.log('No changes detected - finishing without API call');
            
            // ปิด editing mode
            let _editingRows = { ...editingRows };
            delete _editingRows[e.newData.uuid];
            setEditingRows(_editingRows);
            setActiveActionRow(null);
            
            // ล้างข้อมูลที่กำลังแก้ไข
            setEditingData(prev => {
                const newData = { ...prev };
                delete newData[e.newData.uuid];
                return newData;
            });
            delete editingDataRef.current[e.newData.uuid];
            
            return;
        }
        
        // ตั้ง flag ว่าเราเป็นคนอัพเดต เพื่อป้องกัน toast ซ้ำจาก socket
        isUpdatingRef.current = true;
        
        // เรียก API เพื่ออัพเดตข้อมูล
        console.log('Calling API with updateData:', updateData);
        const response = await api.put(`/guests/${e.newData.uuid}`, updateData);
        
        console.log('Update response:', response.data);
        console.log('API call successful');
        
        // อัพเดต state
        let _guests = [...guests];
        _guests[e.index] = e.newData;
        setGuests(_guests);
        
        // ปิด editing mode และ action buttons
        let _editingRows = { ...editingRows };
        delete _editingRows[e.newData.uuid];
        setEditingRows(_editingRows);
        setActiveActionRow(null);
        
        // ล้างข้อมูลที่กำลังแก้ไข
        setEditingData(prev => {
            const newData = { ...prev };
            delete newData[e.newData.uuid];
            return newData;
        });
        
        // ล้าง ref ด้วย
        delete editingDataRef.current[e.newData.uuid];
        
        // Refresh guest list เพื่อให้ข้อมูลเวลาอัพเดต
        fetchGuests();
        
        // แสดง toast message ที่แตกต่างกันตามการเปลี่ยนแปลง
        if (updateData.checked_in === 'TRUE') {
            toast.current.show({
                severity: 'success',
                summary: 'Manual Check-in Success',
                detail: response.data.guest ? 
                    `${response.data.guest.name} from ${response.data.guest.company} checked in manually` :
                    'Guest checked in manually',
                life: 5000
            });
        } else if (updateData.checked_in === 'FALSE') {
            toast.current.show({
                severity: 'info',
                summary: 'Status Updated',
                detail: 'Guest status updated to not checked in',
                life: 3000
            });
        } else if (updateData.Food) {
            toast.current.show({
                severity: 'success',
                summary: 'Food Preference Updated',
                detail: `Food preference updated to: ${updateData.Food}`,
                life: 3000
            });
        }
        
    } catch (error) {
        console.error('Error updating guest:', error);
        console.error('Error response:', error.response?.data);
        toast.current.show({
            severity: 'error',
            summary: 'Error',
            detail: error.response?.data?.message || 'Failed to update guest status'
        });
    }
};

    const onRowEditCancel = (e) => {
        console.log('Row edit cancelled for:', e.data.name);
        // ปิด action buttons เมื่อ cancel
        setActiveActionRow(null);
    };

    const statusEditor = (options) => {
        // console.log('statusEditor - options:', options);
        // console.log('statusEditor - current value:', options.value);
        // console.log('statusEditor - rowData:', options.rowData);
        
        return (
            <Dropdown
                value={options.value}
                options={statuses}
                onChange={(e) => {
                    // console.log('statusEditor - onChange triggered');
                    // console.log('statusEditor - old value:', options.value);
                    // console.log('statusEditor - new value:', e.value);
                    // console.log('statusEditor - rowData:', options.rowData);
                    
                    // เรียก editorCallback ก่อน
                    options.editorCallback(e.value);
                    
                    // เก็บข้อมูลที่แก้ไขไว้
                    const rowData = options.rowData;
                    const updatedData = {
                        ...rowData,
                        checked_in: e.value
                    };
                    
                    // console.log('statusEditor - saving to editingData:', updatedData);
                    
                    // เก็บใน state และ ref
                    setEditingData(prev => {
                        const newEditingData = {
                            ...prev,
                            [rowData.uuid]: updatedData
                        };

                        
                        // เก็บใน ref ด้วย
                        editingDataRef.current = newEditingData;
                        
                        return newEditingData;
                    });
                }}
                placeholder="Select a Status"
                itemTemplate={(option) => {
                    return <Tag value={option} severity={getSeverity(option)}></Tag>;
                }}
            />
        );
    };

    // Food editor with editable dropdown
    const foodEditor = (options) => {
        const foodOptions = ['Salmon', 'Beef', 'Unknown'];
        
        return (
            <Dropdown
                value={options.value}
                options={foodOptions}
                onChange={(e) => {
                    // เรียก editorCallback ก่อนเพื่ออัพเดต UI
                    options.editorCallback(e.value);
                    
                    // เก็บข้อมูลที่แก้ไขไว้ใน editingDataRef
                    const rowData = options.rowData;
                    const uuid = rowData.uuid;
                    
                    // อัพเดต editingDataRef โดยตรง
                    if (!editingDataRef.current[uuid]) {
                        editingDataRef.current[uuid] = { ...rowData };
                    }
                    editingDataRef.current[uuid].Food = e.value;
                    
                    // อัพเดต editingData state เพื่อให้ component re-render
                    setEditingData(prev => {
                        const newEditingData = {
                            ...prev,
                            [uuid]: {
                                ...prev[uuid],
                                ...rowData,
                                Food: e.value
                            }
                        };
                        
                        // console.log('foodEditor - editingData state updated:', newEditingData);
                        return newEditingData;
                    });
                }}
                placeholder="Select Food"
                editable
                className="w-full"
            />
        );
    };


    // Custom row editor template with delete button
    const isEdit = (rowData) => {
        const isActive = activeActionRow === rowData.uuid;
        const isEditing = editingRows[rowData.uuid];
        
        if (isActive && !isEditing) {
            // แสดง 3 ปุ่ม: Edit, Delete, Cancel
            return (
                <div className="flex gap-2 justify-center">
                    <Button rounded
                        label="Edit"
                        className="p-button-sm p-button-primary" 
                        onClick={() => {
                            console.log('Edit button clicked for:', rowData.name);
                            // เปิด row editing mode
                            let _editingRows = { ...editingRows };
                            _editingRows[rowData.uuid] = true;
                            setEditingRows(_editingRows);
                            forceUpdateTable(); // บังคับ re-render เมื่อเข้าสู่ edit mode
                        }}
                    />
                    <Button rounded
                        label="Delete"
                        className="p-button-sm p-button-danger" 
                        onClick={() => {
                            console.log('Delete button clicked for:', rowData.name);
                            handleDeleteGuest(rowData);
                            setActiveActionRow(null);
                        }}
                    />
                    <Button rounded
                        label="Cancel"
                        className="p-button-sm p-button-secondary" 
                        onClick={() => {
                            console.log('Cancel button clicked for:', rowData.name);
                            setActiveActionRow(null);
                            forceUpdateTable(); // บังคับ re-render เมื่อปิด action buttons
                        }}
                    />
                </div>
            );
        } else if (isEditing) {
            // กำลัง edit อยู่ - แสดง Save & Cancel ปุ่ม
            return (
                <div className="flex gap-2 justify-center">
                    <Button 
                        icon="pi pi-check"
                        className="p-button-rounded p-button-sm p-button-success" 
                        onClick={() => {
                            
                            // ใช้ข้อมูลจาก ref ก่อน แล้วค่อย fallback ไป state
                            const updatedData = editingDataRef.current[rowData.uuid] || editingData[rowData.uuid] || rowData;
                            const index = guests.findIndex(g => g.uuid === rowData.uuid);
                            
                            
                            // เรียก onRowEditComplete กับข้อมูลที่แก้ไขแล้ว
                            onRowEditComplete({
                                originalEvent: null,
                                data: rowData,
                                newData: updatedData,
                                field: 'checked_in',
                                index: index
                            });
                        }}
                        tooltip="Save"
                    />
                    <Button 
                        icon="pi pi-times"
                        className="p-button-rounded p-button-sm p-button-danger" 
                        onClick={() => {
                            console.log('Cancel edit clicked for:', rowData.name);
                            // ยกเลิกการ edit
                            let _editingRows = { ...editingRows };
                            delete _editingRows[rowData.uuid];
                            setEditingRows(_editingRows);
                            setActiveActionRow(null);
                            
                            // ล้างข้อมูลที่กำลังแก้ไข
                            setEditingData(prev => {
                                const newData = { ...prev };
                                delete newData[rowData.uuid];
                                return newData;
                            });
                            
                            // ล้าง ref ด้วย
                            delete editingDataRef.current[rowData.uuid];
                            forceUpdateTable(); // บังคับ re-render เมื่อ cancel edit
                        }}
                        tooltip="Cancel"
                    />
                </div>
            );
        } else {
            // แสดงแค่ปุ่มเฟือง
            return (
                <div className="flex">
                    <Button 
                        icon="pi pi-cog"
                        className="p-button-rounded p-button-sm" 
                        onClick={() => {
                            console.log('Settings button clicked for:', rowData.name);
                            setActiveActionRow(rowData.uuid);
                            forceUpdateTable(); // บังคับ re-render เมื่อเปิด action buttons
                        }}
                        tooltip="Actions"
                    />
                </div>
            );
        }
    };

    const handleScan = async (uuid) => {
        try {
            // เรียก API โดยตรงแทน queue เพื่อให้ได้ error response ที่ถูกต้อง
            const response = await api.post(`/checkin/${uuid}`);
            
            if (response.status === 200) {
                toast.current.show({
                    severity: 'success',
                    summary: 'Check-in Success',
                    detail: `${response.data.name} from ${response.data.company}`,
                    life: 5000
                });
                // Refresh guest list
                fetchGuests();
            } else {
                toast.current.show({
                    severity: 'error',
                    summary: 'Check-in Failed',
                    detail: response.data.message || 'Unknown error',
                    life: 5000
                });
            }
        } catch (error) {
            console.error('Direct API Error:', error);
            console.error('Error response:', error.response);
            console.error('Error status:', error.response?.status);
            console.error('Error data:', error.response?.data);
            
            // เช็คว่าเป็น error แบบไหน
            if (error.response?.status === 409) {
                // กรณีเช็คอินซ้ำ (409 Conflict)
                const guest = error.response.data.guest;
                toast.current.show({
                    severity: 'warn',
                    summary: 'Already Checked In',
                    detail: `${guest.name} from ${guest.company} has already checked in`,
                    life: 5000
                });
            } else if (error.response?.status === 404) {
                // กรณีไม่เจอแขก (404 Not Found)
                toast.current.show({
                    severity: 'error',
                    summary: 'Guest Not Found',
                    detail: 'Guest not found. Failed to check-in guest',
                    life: 5000
                });
            } else {
                // กรณีอื่นๆ
                toast.current.show({
                    severity: 'error',
                    summary: 'Error',
                    detail: error.response?.data?.message || 'Failed to check-in guest',
                    life: 5000
                });
            }
        }
    };

    // ฟังก์ชันสำหรับ toggle scan listening mode
    const toggleScanListening = () => {
        console.log('Toggle scan listening clicked, current state:', scanListening);
        
        if (scanListening) {
            // ปิด scan listening
            setScanListening(false);
            stopScanListening();
            toast.current.show({
                severity: 'info',
                summary: 'Scan Listening Disabled',
                detail: 'Manual check-in mode only',
                life: 3000
            });
        } else {
            // เปิด scan listening
            setScanListening(true);
            startScanListening();
            toast.current.show({
                severity: 'success',
                summary: 'Scan Listening Enabled',
                detail: 'Ready to receive scanned QR codes. Try typing and pressing Enter to test.',
                life: 5000
            });
        }
    };

    // ฟังก์ชันเริ่ม listening สำหรับ scan
    const startScanListening = () => {
        // ลบ event listener เดิมก่อน (เผื่อมีอยู่แล้ว)
        document.removeEventListener('keydown', handleKeyboardScan);
        // เพิ่ม event listener ใหม่
        document.addEventListener('keydown', handleKeyboardScan);
        console.log('Started listening for keyboard events');
        
        // เก็บสถานะใน ref
        if (!socketRef.current) {
            socketRef.current = {};
        }
        socketRef.current.scanListening = true;
        
        // เตรียม socket connection สำหรับอนาคต (ถ้าต้องการ)
        if (!socketRef.current.socket) {
            const socketURL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3001';
            socketRef.current.socket = io(socketURL);
            socketRef.current.socket.on('scanner-input', handleSocketScan);
        }
    };

    // ฟังก์ชันหยุด listening
    const stopScanListening = () => {
        // หยุดฟัง keyboard
        document.removeEventListener('keydown', handleKeyboardScan);
        console.log('Stopped listening for keyboard events');
        
        // อัพเดตสถานะใน ref
        if (socketRef.current) {
            socketRef.current.scanListening = false;
        }
        
        // ล้าง buffer ที่เหลือ
        scanBufferRef.current = '';
        console.log('Buffer cleared on stop');
        
        // ปิด socket connection
        if (socketRef.current?.socket) {
            socketRef.current.socket.disconnect();
            socketRef.current.socket = null;
        }
    };

    // สร้าง event handler ที่ไม่มี dependency เปลี่ยนแปลง
    const handleKeyboardScan = useCallback((event) => {
        console.log('=== KEYBOARD EVENT DETECTED ===');
        console.log('scanListening (current):', scanListening);
        console.log('scanListening (from ref):', socketRef.current?.scanListening);
        console.log('event.key:', event.key);
        console.log('event.code:', event.code);
        
        // ใช้ ref เพื่อเช็ค state แทน
        if (!socketRef.current?.scanListening) {
            console.log('Scan listening is disabled, ignoring event');
            return;
        }

        // ป้องกันการประมวลผล modifier keys
        if (event.ctrlKey || event.altKey || event.metaKey) {
            console.log('Modifier key detected, ignoring');
            return;
        }

        // เช็คว่าเป็น Enter (สิ้นสุดการสแกน)
        if (event.key === 'Enter') {
            const currentBuffer = scanBufferRef.current.trim();
            console.log('=== ENTER PRESSED ===');
            console.log('Current buffer:', currentBuffer);
            console.log('Buffer length:', currentBuffer.length);
            
            if (currentBuffer.length > 0) {
                // ตรวจสอบว่าเป็น UUID format หรือไม่
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (uuidRegex.test(currentBuffer)) {
                    console.log('✅ Valid UUID detected, calling handleScan:', currentBuffer);
                    handleScan(currentBuffer);
                    toast.current.show({
                        severity: 'success',
                        summary: 'QR Code Scanned',
                        detail: `Processing UUID: ${currentBuffer.substring(0, 8)}...`,
                        life: 2000
                    });
                } else {
                    console.log('❌ Invalid UUID format:', currentBuffer);
                    toast.current.show({
                        severity: 'warn',
                        summary: 'Invalid QR Code',
                        detail: `Scanned: "${currentBuffer}" - Not a valid UUID format`,
                        life: 5000
                    });
                }
                scanBufferRef.current = '';
                console.log('Buffer cleared');
            } else {
                console.log('Buffer is empty');
            }
            return;
        }

        // รับทุก character ที่พิมพ์เข้ามา
        if (event.key.length === 1) {
            scanBufferRef.current += event.key;
            console.log('Character added:', event.key);
            console.log('New buffer:', scanBufferRef.current);
            
            // ตั้ง timeout เพื่อล้าง buffer ถ้าไม่ได้ scan ต่อ
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
            scanTimeoutRef.current = setTimeout(() => {
                console.log('⏰ Buffer timeout, clearing buffer:', scanBufferRef.current);
                scanBufferRef.current = '';
            }, 1000);
        }
    }, []); // ไม่มี dependency แล้ว

    // Handle socket-based scan (สำหรับอนาคต)
    const handleSocketScan = (data) => {
        if (data && data.uuid) {
            handleScan(data.uuid);
        }
    };

    // Fetch guests data และเชื่อมต่อ socket
    useEffect(() => {
        fetchGuests();
        
        // เชื่อมต่อ socket.io
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const socketUrl = apiUrl.replace('/api', ''); // ลบ /api ออกสำหรับ socket.io
        console.log('Connecting to socket at:', socketUrl);
        
        const socket = io(socketUrl, {
            transports: ['polling', 'websocket'], // ใช้ polling ก่อน แล้วค่อย upgrade เป็น websocket
            timeout: 10000, // เพิ่ม timeout เป็น 10 วินาที
            forceNew: true, // บังคับสร้าง connection ใหม่
            reconnection: true, // เปิดการ reconnect อัตโนมัติ
            reconnectionAttempts: 5, // พยายาม reconnect สูงสุด 5 ครั้ง
            reconnectionDelay: 1000, // รอ 1 วินาที ก่อน reconnect
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });
        socketRef.current = { socket };

        // Event handlers
        socket.on('connect', () => {
            console.log('Socket connected successfully');
        });

        socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            // ไม่ต้องแสดง error เพราะอาจรบกวนการใช้งาน
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        // ฟัง event สำหรับ data update
        socket.on('data-updated', (data) => {
            console.log('Data updated from another device:', data);
            console.log('isUpdatingRef.current:', isUpdatingRef.current);
            
            // แสดง toast เฉพาะตอนที่ไม่ใช่เราเป็นคนอัพเดต
            if (!isUpdatingRef.current) {
                toast.current.show({
                    severity: 'info',
                    summary: 'Data Updated',
                    detail: 'Guest data has been updated from another device',
                    life: 3000
                });
            } else {
                console.log('Skipping toast - this device triggered the update');
            }
            
            // Refresh ข้อมูล
            fetchGuests();
            
            // Reset flag หลังจาก 1 วินาที
            setTimeout(() => {
                isUpdatingRef.current = false;
            }, 1000);
        });

        // Cleanup เมื่อ component unmount
        return () => {
            if (socket && socket.connected) {
                socket.disconnect();
            }
        };
    }, []);

    // Cleanup เมื่อ component unmount (สำหรับ keyboard listener)
    useEffect(() => {
        return () => {
            // ทำความสะอาด keyboard listener
            document.removeEventListener('keydown', handleKeyboardScan);
            
            // ทำความสะอาด scan buffer
            scanBufferRef.current = '';
            
            // ทำความสะอาด timeout
            if (scanTimeoutRef.current) {
                clearTimeout(scanTimeoutRef.current);
            }
        };
    }, [handleKeyboardScan]);

    const fetchGuests = async () => {
        try {
            const { data } = await api.get('/guests');
            setGuests(data);
            
            // Calculate stats
            setStats({
                total: data.length,
                checkedIn: data.filter(guest => guest.checked_in == 'TRUE').length
            });
            
            // Calculate food stats
            calculateFoodStats(data);
            setError('');
            // ปิด action buttons และ editing rows เมื่อ refresh ข้อมูล
            setActiveActionRow(null);
            setEditingRows({});
            setEditingData({});
            editingDataRef.current = {};
        } catch (error) {
            console.error('Error fetching guests:', error);
            setError('Failed to load guest list. Please try again.');
        }
    };

    const handleAddGuest = async (e) => {
        e.preventDefault();
        try {
            console.log('Adding new guest:', newGuest);
            
            const { data } = await api.post('/guests', newGuest);
            
            console.log('Guest added successfully:', data);
            
            // ล้างฟอร์ม
            setNewGuest({ 
                name: '', 
                email: '', 
                company: '', 
                phone: '', 
                allergies: '',
                food: '',
                position: '',
                remark: ''
            });
            
            // Refresh guest list
            fetchGuests();
            
            // แสดง toast success
            toast.current.show({
                severity: 'success',
                summary: 'Guest Added',
                detail: `${newGuest.name} has been added successfully`,
                life: 3000
            });
            
            setError('');
        } catch (error) {
            console.error('Error adding guest:', error);
            console.error('Error response:', error.response?.data);
            
            // แสดง toast error
            toast.current.show({
                severity: 'error',
                summary: 'Error',
                detail: error.response?.data?.error || 'Failed to add guest. Please try again.',
                life: 5000
            });
            
            setError('Failed to add guest. Please try again.');
        }
    };

    const handleDeleteGuest = async (guest) => {
        confirmDialog({
            message: `Are you sure you want to delete ${guest.name} from ${guest.company}?`,
            header: 'Delete Confirmation',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    console.log('Deleting guest:', guest);
                    
                    await api.delete(`/guests/${guest.uuid}`);
                    
                    // Refresh guest list
                    fetchGuests();
                    
                    // แสดง toast success
                    toast.current.show({
                        severity: 'success',
                        summary: 'Guest Deleted',
                        detail: `${guest.name} has been deleted successfully`,
                        life: 3000
                    });
                    
                } catch (error) {
                    console.error('Error deleting guest:', error);
                    console.error('Error response:', error.response?.data);
                    
                    // แสดง toast error
                    toast.current.show({
                        severity: 'error',
                        summary: 'Error',
                        detail: error.response?.data?.error || 'Failed to delete guest. Please try again.',
                        life: 5000
                    });
                }
            }
        });
    };

    const header = renderHeader();


    return (
        <>
        <div className="container mx-auto p-4">
            <Toast ref={toast} />
            <ConfirmDialog />
            
            {/* Action Buttons */}
            <div className="flex gap-4 mb-4">
                {/* Manual Check-in Button */}
                <Button 
                    icon="pi pi-user-plus"
                    label="Manual Check-in"
                    className="p-button-primary"
                    onClick={() => setCheckInDialogVisible(true)}
                />
                
                {/* Scan Listening Toggle Switch */}
                <div className="flex items-center gap-4 p-3 border rounded-lg bg-white">
                    <div className="flex items-center gap-3">
                        <i className={`pi ${scanListening ? 'pi-pause text-orange-500' : 'pi-play text-green-500'} text-xl`}></i>
                        <div className="flex flex-col gap-1">
                            <label htmlFor="scan-switch" className="text-sm font-medium text-gray-700">
                                QR Scanner Mode
                            </label>
                            <span className="text-xs text-gray-500">
                                {scanListening ? "Listening for QR codes..." : "Click to start scanning"}
                            </span>
                        </div>
                    </div>
                    <InputSwitch 
                        id="scan-switch"
                        checked={scanListening}
                        onChange={(e) => {
                            console.log('InputSwitch toggled to:', e.value);
                            setScanListening(e.value);
                            if (e.value) {
                                startScanListening();
                            } else {
                                stopScanListening();
                            }
                        }}
                    />
                </div>
                
                {/* Status Indicator */}
                {scanListening && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-100 text-green-800 rounded-lg">
                        <i className="pi pi-circle-fill animate-pulse text-green-500"></i>
                        <span className="text-sm font-medium">Listening for scans...</span>
                    </div>
                )}
                
                {/* Test Button */}
                {scanListening && (
                    <Button 
                        icon="pi pi-cog"
                        label="Test Input"
                        className="p-button-secondary"
                        onClick={() => {
                            const testUuid = '8f6f2a76-ece2-49d2-be40-5f49a1c4abfd';
                            console.log('Manual test - adding to buffer:', testUuid);
                            scanBufferRef.current = testUuid;
                            // Simulate Enter key
                            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
                            handleKeyboardScan(enterEvent);
                        }}
                    />
                )}
            </div>

            {/* Check-in Dialog */}
            <CheckInDialog
                visible={checkInDialogVisible}
                onHide={() => setCheckInDialogVisible(false)}
                onCheckIn={handleScan}
            />

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {/* Total Guests */}
                <div className="bg-white rounded-lg shadow-md p-4 border">
                    <h2 className="text-xl font-bold mb-2 text-gray-800">Total Guests</h2>
                    <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                </div>
                
                {/* Checked In */}
                <div className="bg-white rounded-lg shadow-md p-4 border">
                    <h2 className="text-xl font-bold mb-2 text-gray-800">Checked In</h2>
                    <p className="text-3xl font-bold text-green-600">{stats.checkedIn}</p>
                </div>
                
                {/* Guest Remaining */}
                <div className="bg-white rounded-lg shadow-md p-4 border">
                    <h2 className="text-xl font-bold mb-2 text-gray-800">Guest Remaining</h2>
                    <p className="text-3xl font-bold text-orange-600">{stats.total - stats.checkedIn}</p>
                </div>
                
                {/* Salmon Remaining - Use inline styles to force styling */}
                <div 
                    key={`salmon-${foodStats?.salmon || 0}`}
                    style={{
                        backgroundColor: (15 - (foodStats?.salmon || 0)) <= 0 ? '#ef4444' : '#ffffff',
                        color: (15 - (foodStats?.salmon || 0)) <= 0 ? '#ffffff' : '#374151',
                        borderColor: (15 - (foodStats?.salmon || 0)) <= 0 ? '#dc2626' : '#d1d5db',
                        borderWidth: '2px',
                        borderStyle: 'solid'
                    }}
                    className="rounded-lg shadow-md p-4 transition-all duration-300"
                >
                    <h2 className="text-xl font-bold mb-2">Salmon Remaining</h2>
                    <div className="text-3xl font-bold mb-2">
                        {Math.max(0, 15 - (foodStats?.salmon || 0))}
                    </div>
                    {(15 - (foodStats?.salmon || 0)) <= 0 && (
                        <div 
                            style={{
                                backgroundColor: '#dc2626',
                                color: '#ffffff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '14px',
                                fontWeight: 'normal',
                                marginTop: '8px'
                            }}
                        >
                            🚨 หมดแล้ว!
                        </div>
                    )}
                    <p style={{
                        fontSize: '12px',
                        opacity: (15 - (foodStats?.salmon || 0)) <= 0 ? '0.8' : '0.6',
                        marginTop: '8px'
                    }}>
                        Used: {foodStats?.salmon || 0} / 15
                    </p>
                </div>
            </div>

           {/* Guest List and Add Guest Form - Full Width Container */}
        </div>
        
        <div className="w-full px-4">
<TabView>
    <TabPanel header="List">
        <DataTable 
            value={guests} 
            editMode="row" 
            dataKey="uuid" 
            onRowEditComplete={onRowEditComplete}
            onRowEditCancel={onRowEditCancel}
            editingRows={editingRows}
            onRowEditChange={setEditingRows}
            filters={filters}
            globalFilterFields={['name', 'email', 'company', 'phone', 'allergies']} 
            header={header} 
            emptyMessage="No guests found."
            tableStyle={{ minWidth: '100%', width: '100%'}}
            style={{ width: '100%' }}
            key={tableKey}
        >
            {/* <Column field="uuid" header="UUID"></Column> */}
            <Column field="name" header="Name" style={{ minWidth: '200px' }} frozen className="font-bold"></Column>
            <Column field="company" header="Company"></Column>
            <Column field="phone" header="Phone"></Column>
            <Column field="allergies" header="Allergies"></Column>
            <Column 
                field="Food" 
                header="Food" 
                style={{ minWidth: '120px' }}
                editor={(options) => foodEditor(options)}
            ></Column>
            <Column field="Position" header="Table" style={{ minWidth: '80px' }}></Column>
            <Column field="remark" header="Remark" style={{ minWidth: '150px' }}></Column>
            <Column 
                field="checked_in" 
                body={statusBodyTemplate} 
                header="Checked In" 
                sortable 
                sortField="checked_in"
                editor={(options) => statusEditor(options)}
            ></Column>
            <Column field="checked_in_time" header="Checked In Time" sortable></Column>
            <Column 
                header="Actions" 
                headerStyle={{ width: '15%', minWidth: '12rem' }} 
                bodyStyle={{ textAlign: 'center' }}
                body={(rowData) => isEdit(rowData)}
            ></Column>
        </DataTable>

    </TabPanel>
    <TabPanel header="Add Guest">
                 {/* Add New Guest Form */}
            <div className="bg-white rounded-lg shadow p-4 mb-8">
                <h2 className="text-xl font-bold mb-4">Add New Guest</h2>
                <form onSubmit={handleAddGuest} className="space-y-4">
                    <div>
                        <label className="block mb-1">Name</label>
                        <input
                            type="text"
                            value={newGuest.name}
                            onChange={(e) => setNewGuest({...newGuest, name: e.target.value})}
                            className="w-full p-2 border rounded"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Email</label>
                        <input
                            type="email"
                            value={newGuest.email}
                            onChange={(e) => setNewGuest({...newGuest, email: e.target.value})}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Company</label>
                        <input
                            type="text"
                            value={newGuest.company}
                            onChange={(e) => setNewGuest({...newGuest, company: e.target.value})}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Phone Number</label>
                        <input
                            type="tel"
                            value={newGuest.phone}
                            onChange={(e) => setNewGuest({...newGuest, phone: e.target.value})}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Allergies/Special Requirements</label>
                        <textarea
                            value={newGuest.allergies}
                            onChange={(e) => setNewGuest({...newGuest, allergies: e.target.value})}
                            className="w-full p-2 border rounded"
                            rows="3"
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Food Preference</label>
                        <input
                            type="text"
                            value={newGuest.food}
                            onChange={(e) => setNewGuest({...newGuest, food: e.target.value})}
                            className="w-full p-2 border rounded"
                            placeholder="e.g., Vegetarian, Halal, etc."
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Position</label>
                        <input
                            type="text"
                            value={newGuest.position}
                            onChange={(e) => setNewGuest({...newGuest, position: e.target.value})}
                            className="w-full p-2 border rounded"
                            placeholder="e.g., 1, 2, VIP, etc."
                        />
                    </div>
                    <div>
                        <label className="block mb-1">Remark</label>
                        <textarea
                            value={newGuest.remark}
                            onChange={(e) => setNewGuest({...newGuest, remark: e.target.value})}
                            className="w-full p-2 border rounded"
                            rows="2"
                            placeholder="Additional notes or remarks"
                        />
                    </div>
                    <Button
                        type="submit"
                        label="Add Guest"
                        icon="pi pi-plus"
                        className="p-button-success"
                    />
                </form>
            </div>
    </TabPanel>


</TabView>
        </div>
        </>
    );
}

export default AdminPage;
