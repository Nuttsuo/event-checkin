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

// Component to get severity based on checked_in value
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

    const statusEditor = (options) => {
        return (
            <Dropdown
                value={options.value}
                options={statuses}
                onChange={(e) => options.editorCallback(e.value)}
                placeholder="Select a Status"
                itemTemplate={(option) => {
                    return <Tag value={option} severity={getSeverity(option)}></Tag>;
                }}
            />
        );
    };

    const allowEdit = (rowData) => {
        return rowData.name !== 'Blue Band';
    };

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

    return (
        <div className="container mx-auto p-4">
            <Toast ref={toast} />
            
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

           {/* Guest List and Add Guest Form =============================================== */}


<TabView>
    <TabPanel header="List">
        <DataTable value={guests} editMode="row" dataKey="uuid" onRowEditComplete={onRowEditComplete} tableStyle={{ minWidth: '50rem' }}>
            {/* <Column field="uuid" header="UUID"></Column> */}
            <Column field="name" header="Name"></Column>
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
            <Column header="Edit" rowEditor={allowEdit} headerStyle={{ width: '10%', minWidth: '8rem' }} bodyStyle={{ textAlign: 'center' }}></Column>
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
    );
}

export default AdminPage;
