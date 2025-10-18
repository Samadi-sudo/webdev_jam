'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
// Icons will be replaced with simple text/HTML entities

interface Trip {
  id: number;
  user_id: string;
  destination: string;
  departure_time: string;
  return_time: string;
  trip_date: string;
  status: string;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  };
  requests?: Request[];
}

interface Request {
  id: number;
  trip_id: number;
  requester_id: string;
  item_name: string;
  details: string;
  price: number;
  status: string;
  created_at: string;
  profiles: {
    name: string;
    email: string;
  };
  trips?: {
    destination: string;
    trip_date: string;
  };
}

interface NewTrip {
  destination: string;
  departure_time: string;
  return_time: string;
  trip_date: string;
}

interface Request {
  id: number;
  tripId: number;
  requester: string;
  item: string;
  details: string;
  estimatedPrice: string;
}

export default function TripsAvailable() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('trips');
  const [newTrip, setNewTrip] = useState<NewTrip>({
    destination: '',
    departure_time: '',
    return_time: '',
    trip_date: ''
  });
  const [requestForm, setRequestForm] = useState({
    requester: '',
    item: '',
    details: '',
    price: ''
  });
  const [requests, setRequests] = useState<Request[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);

  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    const getUserAndTrips = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        router.push('/');
        return;
      }

      setUser(session.user);

      // Ensure user has a profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create one
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: session.user.id,
              name: session.user.email?.split('@')[0] || 'User',
              email: session.user.email
            }
          ]);

        if (insertError) {
          console.error('Error creating profile:', insertError);
        }
      } else if (profileError) {
        console.error('Error fetching profile:', profileError);
      }

      // Fetch trips with user profiles and requests
      const { data: tripsData, error } = await supabase
        .from('trips')
        .select(`
          *,
          profiles (
            name,
            email
          ),
          requests (
            id,
            item_name,
            details,
            price,
            status,
            created_at,
            profiles (
              name,
              email
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trips:', error);
      } else {
        setTrips(tripsData || []);
      }

      // Fetch requests for the current user
      const { data: requestsData, error: requestsError } = await supabase
        .from('requests')
        .select(`
          *,
          profiles (
            name,
            email
          ),
          trips (
            destination,
            trip_date
          )
        `)
        .eq('requester_id', session.user.id)
        .order('created_at', { ascending: false });

      if (requestsError) {
        console.error('Error fetching requests:', requestsError);
      } else {
        setRequests(requestsData || []);
      }

      setLoading(false);
    };

    getUserAndTrips();
  }, [supabase, router]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Validate required fields
    if (!newTrip.destination || !newTrip.trip_date || !newTrip.departure_time || !newTrip.return_time) {
      alert('Please fill in all required fields');
      setSubmitting(false);
      return;
    }

    if (!user?.id) {
      alert('User not authenticated');
      setSubmitting(false);
      return;
    }

    try {
      // Format the data properly for the database
      const tripData = {
        destination: newTrip.destination.trim(),
        trip_date: newTrip.trip_date,
        departure_time: new Date(`${newTrip.trip_date}T${newTrip.departure_time}`).toISOString(),
        return_time: new Date(`${newTrip.trip_date}T${newTrip.return_time}`).toISOString(),
        user_id: user.id,
        status: 'open'
      };

      console.log('Creating trip with data:', tripData);

      const { data, error } = await supabase
        .from('trips')
        .insert([tripData])
        .select();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (data) {
        console.log('Trip created successfully:', data);
        
        // Refresh the trips list
        const { data: updatedTrips } = await supabase
          .from('trips')
          .select(`
            *,
            profiles (
              name,
              email
            ),
            requests (
              id,
              item_name,
              details,
              price,
              status,
              created_at,
              profiles (
                name,
                email
              )
            )
          `)
          .order('created_at', { ascending: false });

        setTrips(updatedTrips || []);
        setNewTrip({
          destination: '',
          departure_time: '',
          return_time: '',
          trip_date: ''
        });
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Error creating trip:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Error creating trip: ${errorMessage}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!requestForm.requester || !requestForm.item || !requestForm.details || !requestForm.price) {
      alert('Please fill all fields');
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('requests')
        .insert([
          {
            trip_id: selectedTrip!,
            requester_id: user?.id,
            item_name: requestForm.item,
            details: requestForm.details,
            price: parseFloat(requestForm.price),
            status: 'pending'
          }
        ])
        .select();

      if (error) throw error;

      if (data) {
        // Refresh the requests list
        const { data: updatedRequests } = await supabase
          .from('requests')
          .select(`
            *,
            profiles (
              name,
              email
            ),
            trips (
              destination,
              trip_date
            )
          `)
          .eq('requester_id', user?.id)
          .order('created_at', { ascending: false });

        setRequests(updatedRequests || []);

        // Refresh trips to update request count
        const { data: updatedTrips } = await supabase
          .from('trips')
          .select(`
            *,
            profiles (
              name,
              email
            ),
            requests (
              id,
              item_name,
              details,
              price,
              status,
              created_at,
              profiles (
                name,
                email
              )
            )
          `)
          .order('created_at', { ascending: false });

        setTrips(updatedTrips || []);

        setShowRequestModal(false);
        setSelectedTrip(null);
        setRequestForm({
          requester: '',
          item: '',
          details: '',
          price: ''
        });
      }
    } catch (error) {
      console.error('Error creating request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateTripStatus = async (tripId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ status: newStatus })
        .eq('id', tripId);

      if (error) throw error;

      // Update local state
      setTrips(trips.map(trip => 
        trip.id === tripId 
          ? { ...trip, status: newStatus }
          : trip
      ));
    } catch (error) {
      console.error('Error updating trip status:', error);
    }
  };

  const handleUpdateRequestStatus = async (requestId: number, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (error) throw error;

      // Update local state
      setTrips(trips.map(trip => ({
        ...trip,
        requests: trip.requests?.map(req => 
          req.id === requestId 
            ? { ...req, status: newStatus }
            : req
        ) || []
      })));

      // Also update the requests list
      setRequests(requests.map(req => 
        req.id === requestId 
          ? { ...req, status: newStatus }
          : req
      ));
    } catch (error) {
      console.error('Error updating request status:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-2xl">🛍️</span>
            <span className="text-xl font-bold">1337 Delivery</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Welcome, {user?.email}</span>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 flex items-center gap-1"
            >
              <span className="text-lg">+</span>
              New Trip
            </button>
              <button
                onClick={handleSignOut}
              className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600"
              >
                Sign Out
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5 border-b">
          <button
            onClick={() => setActiveTab('trips')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'trips'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Available Trips
          </button>
          <button
            onClick={() => setActiveTab('mytrips')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mytrips'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Trips
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Requests
          </button>
        </div>

        {showCreateForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-5 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Post a trip</h2>
              <form onSubmit={handleCreateTrip} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Your name</label>
                  <input
                    type="text"
                    value={user?.email?.split('@')[0] || ''}
                    disabled
                    className="w-full px-3 py-2 border rounded text-sm bg-gray-100"
                    placeholder="e.g. Mohamed A."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Where are you going?</label>
                  <input
                    type="text"
                    required
                    value={newTrip.destination}
                    onChange={(e) => setNewTrip(prev => ({ ...prev, destination: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="e.g. Marjane, Carrefour"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Leave at</label>
                    <input
                      type="time"
                      required
                      value={newTrip.departure_time}
                      onChange={(e) => setNewTrip(prev => ({ ...prev, departure_time: e.target.value }))}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Back at</label>
                    <input
                      type="time"
                      required
                      value={newTrip.return_time}
                      onChange={(e) => setNewTrip(prev => ({ ...prev, return_time: e.target.value }))}
                      className="w-full px-3 py-2 border rounded text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">When?</label>
                  <input
                    type="date"
                    required
                    value={newTrip.trip_date}
                    onChange={(e) => setNewTrip(prev => ({ ...prev, trip_date: e.target.value }))}
                    className="w-full px-3 py-2 border rounded text-sm"
                  />
                </div>
                <div className="flex gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Post'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showRequestModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-5 max-w-md w-full">
              <h2 className="text-xl font-bold mb-4">Request an item</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Your name</label>
                  <input
                    value={requestForm.requester}
                    onChange={(e) => setRequestForm({...requestForm, requester: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="e.g. Youssef M."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">What do you need?</label>
                  <input
                    value={requestForm.item}
                    onChange={(e) => setRequestForm({...requestForm, item: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="e.g. USB cable"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Details</label>
                  <textarea
                    value={requestForm.details}
                    onChange={(e) => setRequestForm({...requestForm, details: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 border rounded text-sm resize-none"
                    placeholder="size, color, brand..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Price (approx)</label>
                  <input
                    value={requestForm.price}
                    onChange={(e) => setRequestForm({...requestForm, price: e.target.value})}
                    className="w-full px-3 py-2 border rounded text-sm"
                    placeholder="e.g. 50 DH"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setSelectedTrip(null);
                  }}
                  className="flex-1 px-4 py-2 border rounded text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRequest}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 flex items-center justify-center gap-1"
                >
                  <span className="text-sm">📤</span>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trips' && (
          <div className="space-y-3">
            {trips.length === 0 ? (
              <div className="bg-white border rounded-lg p-12 text-center">
                <span className="text-6xl text-gray-300 mb-3 block">📦</span>
                <p className="text-gray-600 mb-3">No trips available yet</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-green-600 text-white px-5 py-2 rounded text-sm hover:bg-green-700"
                >
                  Post a trip
                </button>
            </div>
          ) : (
              trips.map(trip => (
                <div key={trip.id} className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 text-lg">👤</span>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{trip.profiles.name}</div>
                        <div className="text-xs text-gray-500">going to {trip.destination}</div>
                      </div>
                    </div>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                      {trip.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-sm">📍</span>
                      <span>{trip.destination}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <span className="text-sm">🕐</span>
                      <span>{formatDate(trip.trip_date)}</span>
                    </div>
                    <div className="text-gray-500 text-xs">
                      Leave: {new Date(trip.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Back: {new Date(trip.return_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <div className="flex items-center gap-1 text-gray-500 text-sm">
                      <span className="text-sm">📦</span>
                      <span>{requests.filter(req => req.tripId === trip.id).length} requests</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedTrip(trip.id);
                        setShowRequestModal(true);
                      }}
                      className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700"
                    >
                      Ask for item
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'mytrips' && (
          <div className="space-y-3">
            {trips.filter(trip => trip.user_id === user?.id).length === 0 ? (
              <div className="bg-white border rounded-lg p-12 text-center">
                <span className="text-6xl text-gray-300 mb-3 block">📦</span>
                <p className="text-gray-600 mb-3">No trips posted yet</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-green-600 text-white px-5 py-2 rounded text-sm hover:bg-green-700"
                >
                  Post a trip
                </button>
              </div>
            ) : (
              trips
                .filter(trip => trip.user_id === user?.id)
                .map(trip => (
                  <div key={trip.id} className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 text-lg">👤</span>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{trip.profiles.name}</div>
                          <div className="text-xs text-gray-500">going to {trip.destination}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                          {trip.status}
                        </span>
                        <button
                          onClick={() => {
                            // Toggle trip status between open and closed
                            const newStatus = trip.status === 'open' ? 'closed' : 'open';
                            handleUpdateTripStatus(trip.id, newStatus);
                          }}
                          className={`text-xs px-2 py-1 rounded ${
                            trip.status === 'open' 
                              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {trip.status === 'open' ? 'Close Trip' : 'Reopen Trip'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-sm">📍</span>
                        <span>{trip.destination}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-sm">🕐</span>
                        <span>{formatDate(trip.trip_date)}</span>
                      </div>
                      <div className="text-gray-500 text-xs">
                        Leave: {new Date(trip.departure_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                      <div className="text-gray-500 text-xs">
                        Back: {new Date(trip.return_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>

                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <span className="text-sm">📦</span>
                          <span>{trip.requests?.length || 0} requests</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          Created: {new Date(trip.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Show requests for this trip */}
                      {trip.requests && trip.requests.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-gray-700 mb-2">Requests:</div>
                          {trip.requests.map(request => (
                            <div key={request.id} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900 text-sm">{request.item_name}</div>
                                  <p className="text-xs text-gray-600 mt-1">{request.details}</p>
                                  <div className="flex gap-3 text-xs text-gray-500 mt-1">
                                    <span>~{request.price} DH</span>
                                    <span>·</span>
                                    <span>by {request.profiles.name}</span>
                                    <span>·</span>
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                      request.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                      request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                      'bg-blue-100 text-blue-700'
                                    }`}>
                                      {request.status}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  {request.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateRequestStatus(request.id, 'accepted')}
                                        className="text-green-600 hover:text-green-700 text-xs px-2 py-1 rounded hover:bg-green-50"
                                      >
                                        Accept
                                      </button>
                                      <button
                                        onClick={() => handleUpdateRequestStatus(request.id, 'rejected')}
                                        className="text-red-600 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
                ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="bg-white border rounded-lg p-12 text-center">
                <span className="text-6xl text-gray-300 mb-3 block">📦</span>
                <p className="text-gray-600 mb-3">No requests yet</p>
              </div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="bg-white border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 mb-1">{req.item_name}</div>
                      <p className="text-sm text-gray-600 mb-2">{req.details}</p>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>~{req.price} DH</span>
                        <span>·</span>
                        <span>Trip to {req.trips?.destination}</span>
                        <span>·</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          req.status === 'accepted' ? 'bg-green-100 text-green-700' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                    </div>
                    <button className="text-green-600 hover:text-green-700">
                      <span className="text-lg">💬</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}