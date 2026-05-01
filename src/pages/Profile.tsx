import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { message } from 'antd';
import { Navigate } from 'react-router-dom';

export default function Profile() {
  const { user, refreshUser, loading } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'IDLE' | 'OTP_SENT'>('IDLE');
  const [submitting, setSubmitting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState(user?.username || '');
  const [editName, setEditName] = useState((user as any)?.name || '');

  if (loading) return <div className="text-center p-10">Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  const requestOtp = async () => {
    if (!phoneNumber) {
      message.error('Please enter a phone number');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile-request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      if (res.ok) {
        message.success('OTP sent! Please check the server console for the mock SMS.');
        setStep('OTP_SENT');
        await refreshUser();
      } else {
        const data = await res.json();
        message.error(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      message.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!code) {
      message.error('Please enter the OTP code');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber, code }),
      });
      if (res.ok) {
        message.success('Phone verified successfully!');
        setStep('IDLE');
        await refreshUser();
      } else {
        const data = await res.json();
        message.error(data.error || 'Invalid OTP');
      }
    } catch (err) {
      message.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/profile-update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: editUsername, name: editName }),
      });
      if (res.ok) {
        message.success('Profile updated successfully!');
        setIsEditing(false);
        await refreshUser();
      } else {
        const data = await res.json();
        message.error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      message.error('An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 mt-10 bg-white rounded-xl shadow">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Profile</h1>
        {!isEditing && (
          <button 
            onClick={() => {
              setEditUsername(user?.username || '');
              setEditName((user as any)?.name || '');
              setIsEditing(true);
            }} 
            className="text-blue-600 hover:text-blue-800 font-semibold"
          >
            Edit Profile
          </button>
        )}
      </div>

      <div className="space-y-4">
        {isEditing ? (
          <div className="space-y-4 max-w-md bg-stone-50 p-4 rounded-lg border border-stone-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Username"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleUpdateProfile}
                disabled={submitting}
                className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Save Changes
              </button>
              <button
                onClick={() => setIsEditing(false)}
                disabled={submitting}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded font-semibold hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <div className="mt-1 text-lg font-semibold">{(user as any)?.name || '-'}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <div className="mt-1 text-lg font-semibold">{user.username || '-'}</div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <div className="mt-1 text-lg font-semibold">{user.email}</div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Role</label>
          <div className="mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
              {user.role}
            </span>
          </div>
        </div>
        
        <div className="pt-6 border-t">
          <h2 className="text-xl font-bold mb-4">Phone Verification</h2>
          {user.isPhoneVerified ? (
            <div className="flex items-center space-x-2 text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span className="font-semibold">Phone verified ({user.phoneNumber})</span>
            </div>
          ) : (
            <div className="space-y-4 max-w-sm">
              <div className="flex items-center space-x-2 text-amber-600 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <span className="font-semibold">Phone not verified</span>
              </div>
              
              {step === 'IDLE' && (
                <div className="flex space-x-2">
                  <input
                    type="tel"
                    placeholder="+1234567890"
                    className="flex-1 appearance-none border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                  />
                  <button
                    onClick={requestOtp}
                    disabled={submitting}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Send OTP
                  </button>
                </div>
              )}

              {step === 'OTP_SENT' && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">OTP sent to {phoneNumber}</p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="6-digit code"
                      className="flex-1 appearance-none border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      value={code}
                      onChange={e => setCode(e.target.value)}
                    />
                    <button
                      onClick={verifyOtp}
                      disabled={submitting}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Verify
                    </button>
                  </div>
                  <button
                    onClick={() => setStep('IDLE')}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Change phone number
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
