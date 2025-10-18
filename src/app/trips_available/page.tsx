'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

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
}

interface NewTrip {
  destination: string;
  departure_time: string;
  return_time: string;
  trip_date: string;
}

export default function TripsAvailable() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTrip, setNewTrip] = useState<NewTrip>({
    destination: '',
    departure_time: '',
    return_time: '',
    trip_date: ''
  });
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

      // Fetch trips with user profiles
      const { data: tripsData, error } = await supabase
        .from('trips')
        .select(`
          *,
          profiles (
            name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching trips:', error);
      } else {
        setTrips(tripsData || []);
      }

      setLoading(false);
    };

    getUserAndTrips();
  }, [supabase, router]);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('trips')
        .insert([
          {
            ...newTrip,
            user_id: user?.id,
            status: 'open'
          }
        ])
        .select();

      if (error) throw error;

      if (data) {
        // Refresh the trips list
        const { data: updatedTrips } = await supabase
          .from('trips')
          .select(`
            *,
            profiles (
              name,
              email
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
    } finally {
      setSubmitting(false);
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Available Trips</h1>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.email}</span>
              <button
                onClick={handleSignOut}
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Create Trip Button */}
        <div className="px-4 sm:px-0 mb-6">
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create New Trip
          </button>
        </div>

        {/* Create Trip Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h2 className="text-xl font-bold mb-4">Create New Trip</h2>
              <form onSubmit={handleCreateTrip} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Destination
                  </label>
                  <input
                    type="text"
                    required
                    value={newTrip.destination}
                    onChange={(e) => setNewTrip(prev => ({ ...prev, destination: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Where are you going?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Date
                  </label>
                  <input
                    type="date"
                    required
                    value={newTrip.trip_date}
                    onChange={(e) => setNewTrip(prev => ({ ...prev, trip_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Departure Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newTrip.departure_time}
                    onChange={(e) => setNewTrip(prev => ({ ...prev, departure_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Return Time
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={newTrip.return_time}
                    onChange={(e) => setNewTrip(prev => ({ ...prev, return_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Trip'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Trips Grid */}
        <div className="px-4 sm:px-0">
          {trips.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No trips available yet.</p>
              <p className="text-gray-400">Be the first to create a trip!</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <div key={trip.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">{trip.destination}</h3>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      trip.status === 'open' 
                        ? 'bg-green-100 text-green-800'
                        : trip.status === 'closed'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {trip.status}
                    </span>
                  </div>
                  
                  <div className="space-y-3 mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Traveler</p>
                      <p className="font-medium">{trip.profiles.name}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Trip Date</p>
                      <p className="font-medium">{formatDate(trip.trip_date)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Departure</p>
                      <p className="font-medium">{formatDateTime(trip.departure_time)}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600">Return</p>
                      <p className="font-medium">{formatDateTime(trip.return_time)}</p>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                      Request Item
                    </button>
                    {trip.user_id === user?.id && (
                      <button className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}