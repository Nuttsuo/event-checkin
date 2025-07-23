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

// Function to get severity based on checked_in value
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
                    detail: `${response.data.Name} from ${response.data.Company}`,
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
            const { data } = await api.post('/guests', newGuest);
            setNewGuest({ 
                name: '', 
                email: '', 
                company: '', 
                phone: '', 
                allergies: '' 
            });
            fetchGuests();
            setError('');
        } catch (error) {
            console.error('Error adding guest:', error);
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
            </div>

           {/* Guest List and Add Guest Form =============================================== */}


<TabView>
    <TabPanel header="List">
        <DataTable value={guests} tableStyle={{ minWidth: '50rem' }}>
            {/* <Column field="uuid" header="UUID"></Column> */}
            <Column field="name" header="Name"></Column>
            <Column field="email" header="Email"></Column>
            <Column field="company" header="Company"></Column>
            <Column field="phone" header="Phone"></Column>
            <Column field="allergies" header="Allergies"></Column>
            <Column body={statusBodyTemplate} header="Checked In"></Column>
            <Column field="checked_in_time" header="Checked In Time" ></Column>
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
                    <button
                        type="submit"
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    >
                        Add Guest
                    </button>
                </form>
            </div>
    </TabPanel>


</TabView>


        </div>
    );
}

export default AdminPage;
