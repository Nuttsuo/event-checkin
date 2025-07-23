import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { TabView, TabPanel } from 'primereact/tabview';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
        


function AdminPage() {
    const [guests, setGuests] = useState([]);
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
<TabView>
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
    <TabPanel header="List">
            <DataTable value={guests} tableStyle={{ minWidth: '50rem' }}>
                {/* <Column field="uuid" header="UUID"></Column> */}
                <Column field="name" header="Name"></Column>
                <Column field="email" header="Email"></Column>
                <Column field="company" header="Company"></Column>
                <Column field="phone" header="Phone"></Column>
                <Column field="allergies" header="Allergies"></Column>
                <Column field="checked_in" header="Checked In"></Column>
                <Column field="checked_in_time" header="Checked In Time"></Column>
            </DataTable>
            {/* Guest List */}
            {/* <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Allergies</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {guests.map((guest) => (
                            <tr key={guest.uuid}>
                                <td className="px-6 py-4 whitespace-nowrap">{guest.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{guest.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{guest.company}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{guest.phone}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{guest.allergies}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        guest.checked_in 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                        {guest.checked_in ? 'Checked In' : 'Not Checked In'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div> */}
    </TabPanel>

</TabView>


        </div>
    );
}

export default AdminPage;
