import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { checkInQueue } from '../utils/checkInQueue';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { InputText } from 'primereact/inputtext';
import { Tag } from 'primereact/tag';
import { Dropdown } from 'primereact/dropdown';
import { IconField } from 'primereact/iconfield';
import 'primeicons/primeicons.css';
import { InputIcon } from 'primereact/inputicon';
import { FilterMatchMode } from 'primereact/api';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

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
            header="Check-in Guest"
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
        email: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
        company: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
        phone: { value: null, matchMode: FilterMatchMode.STARTS_WITH },
        checked_in: { value: null, matchMode: FilterMatchMode.EQUALS },
        allergies: { value: null, matchMode: FilterMatchMode.CONTAINS }
    });

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
    const statusBodyTemplate = (rowData) => {
        return <Tag value={rowData.checked_in} severity={getSeverity(rowData.checked_in)}></Tag>;
    };
// ==============================================================
//#endregion

// Component to edit table data
// ==============================================================
    const onRowEditComplete = async (e) => {
    try {
        console.log('Updating guest:', e.newData);
        console.log('UUID:', e.newData.uuid);
        console.log('New status:', e.newData.checked_in);
        
        // เรียก API เพื่ออัพเดตข้อมูล
        const response = await api.put(`/guests/${e.newData.uuid}`, {
            checked_in: e.newData.checked_in
        });
        
        console.log('Update response:', response.data);
        
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
        
        // แสดง toast message ที่แตกต่างกันตามสถานะ
        if (e.newData.checked_in === 'TRUE') {
            toast.current.show({
                severity: 'success',
                summary: 'Manual Check-in Success',
                detail: response.data.guest ? 
                    `${response.data.guest.name} from ${response.data.guest.company} checked in manually` :
                    'Guest checked in manually',
                life: 5000
            });
        } else {
            toast.current.show({
                severity: 'info',
                summary: 'Status Updated',
                detail: 'Guest status updated to not checked in',
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
        console.log('statusEditor - options:', options);
        console.log('statusEditor - current value:', options.value);
        console.log('statusEditor - rowData:', options.rowData);
        
        return (
            <Dropdown
                value={options.value}
                options={statuses}
                onChange={(e) => {
                    console.log('statusEditor - onChange triggered');
                    console.log('statusEditor - old value:', options.value);
                    console.log('statusEditor - new value:', e.value);
                    console.log('statusEditor - rowData:', options.rowData);
                    
                    // เรียก editorCallback ก่อน
                    options.editorCallback(e.value);
                    
                    // เก็บข้อมูลที่แก้ไขไว้
                    const rowData = options.rowData;
                    const updatedData = {
                        ...rowData,
                        checked_in: e.value
                    };
                    
                    console.log('statusEditor - saving to editingData:', updatedData);
                    
                    // เก็บใน state และ ref
                    setEditingData(prev => {
                        const newEditingData = {
                            ...prev,
                            [rowData.uuid]: updatedData
                        };
                        console.log('statusEditor - prev editingData:', prev);
                        console.log('statusEditor - new editingData:', newEditingData);
                        console.log('statusEditor - rowData.uuid:', rowData.uuid);
                        
                        // เก็บใน ref ด้วย
                        editingDataRef.current = newEditingData;
                        console.log('statusEditor - editingDataRef.current:', editingDataRef.current);
                        
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


    // Custom row editor template with delete button
    const isEdit = React.useCallback((rowData) => {
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
                            console.log('=== SAVE BUTTON CLICKED ===');
                            console.log('Save button clicked for:', rowData.name);
                            console.log('rowData.uuid:', rowData.uuid);
                            console.log('Current editingData state:', editingData);
                            console.log('Current editingDataRef.current:', editingDataRef.current);
                            console.log('editingData for this row (state):', editingData[rowData.uuid]);
                            console.log('editingData for this row (ref):', editingDataRef.current[rowData.uuid]);
                            console.log('Original rowData:', rowData);
                            
                            // ใช้ข้อมูลจาก ref ก่อน แล้วค่อย fallback ไป state
                            const updatedData = editingDataRef.current[rowData.uuid] || editingData[rowData.uuid] || rowData;
                            const index = guests.findIndex(g => g.uuid === rowData.uuid);
                            
                            console.log('Final data to save:', updatedData);
                            console.log('Comparison - original checked_in:', rowData.checked_in);
                            console.log('Comparison - new checked_in:', updatedData.checked_in);
                            
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
                        }}
                        tooltip="Actions"
                    />
                </div>
            );
        }
    }, [activeActionRow, editingRows, editingData]);

    const [stats, setStats] = useState({
        total: 0,
        checkedIn: 0
    });
    const [newGuest, setNewGuest] = useState({
        name: '',
        email: '',
        company: '',
        phone: '',
        allergies: ''
    });
    const [error, setError] = useState('');

    const handleScan = async (uuid) => {
        try {
            // เพิ่มเข้า queue แทนที่จะเรียก API โดยตรง
            const response = await checkInQueue.add(uuid);
            
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
            console.error('Error:', error);
            toast.current.show({
                severity: 'error',
                summary: 'Error',
                detail: 'Guest not found. Failed to check-in guest',
                life: 5000
            });
        }
    };

    // Fetch guests data
    useEffect(() => {
        fetchGuests();
    }, []);

    const fetchGuests = async () => {
        try {
            const { data } = await api.get('/guests');
            setGuests(data);
            
            // Calculate stats
            setStats({
                total: data.length,
                checkedIn: data.filter(guest => guest.checked_in == 'TRUE').length
            });
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
                allergies: '' 
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
            
            {/* Check-in Button */}
            <Button 
                icon="pi pi-user-plus"
                label="Check-in Guest"
                className="p-button-primary mb-4"
                onClick={() => setCheckInDialogVisible(true)}
            />

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-xl font-bold mb-2">Total Guests</h2>
                    <p className="text-3xl">{stats.total}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-xl font-bold mb-2">Checked In</h2>
                    <p className="text-3xl">{stats.checkedIn}</p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-xl font-bold mb-2">Remaining</h2>
                    <p className="text-3xl">{stats.total - stats.checkedIn}</p>
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
            key={`datatable-${activeActionRow || 'none'}`}
        >
            {/* <Column field="uuid" header="UUID"></Column> */}
            <Column field="name" header="Name" style={{ minWidth: '200px' }} frozen className="font-bold"></Column>
            <Column field="email" header="Email"></Column>
            <Column field="company" header="Company"></Column>
            <Column field="phone" header="Phone"></Column>
            <Column field="allergies" header="Allergies"></Column>
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
