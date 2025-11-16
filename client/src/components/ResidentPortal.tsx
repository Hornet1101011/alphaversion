import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { residentPersonalInfoAPI } from '../services/api';
import axios, { AxiosResponse } from 'axios';
import { Form, Input, Button, Select, Typography, Divider, Row, Col, Card, Space, message, Switch, Upload, Alert } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import ResidentCreateModal from './ResidentCreateModal';
import { useAuth } from '../contexts/AuthContext';
import AvatarImage from './AvatarImage';

interface ResidentProfile {
	_id: string;
	username: string;
	email: string;
	address: string;
	contactNumber: string;
	barangayID: string;
	role: string;
	// Optional display name provided by the user (used to derive first/last name)
	fullName?: string;
}
// Personal info fields (example, adjust as needed)
interface PersonalInfo {
	barangayID?: string;
	spouseMiddleName?: string;
	spouseLastName?: string;
	middleName?: string;
	nationality?: string;
	placeOfBirth?: string;
	religion?: string;
	maritalStatus?: string;
	passportNumber?: string;
	governmentIdNumber?: string;
	bloodType?: string;
	disabilityStatus?: string;
	occupation?: string;
	educationalAttainment?: string;
	// Family Information
	numberOfChildren?: number;
	childrenNames?: string;
	childrenAges?: string;
	spouseNationality?: string;
	spouseContactNumber?: string;
	emergencyContactName?: string;
	emergencyContactRelationship?: string;
	// Business Information
	businessName?: string;
	businessType?: string;
	natureOfBusiness?: string;
	businessAddress?: string;
	dateEstablished?: string;
	tin?: string;
	registrationNumber?: string;
	businessPermitNumber?: string;
	barangayClearanceNumber?: string;
	numberOfEmployees?: number;
	capitalInvestment?: number;
	annualGrossIncome?: number;
	businessContactPerson?: string;
	businessContactNumber?: string;
	businessEmail?: string;
	firstName: string;
	lastName: string;
	age?: number;
	birthDate?: string;
	dateOfResidency?: string;
	sex?: string;
	civilStatus?: string;
	facebook?: string;
	email?: string;
	contactNumber?: string;
	emergencyContact?: string;
	landlineNumber?: string;
	spouseName?: string;
	spouseAge?: number;
	spouseBirthDate?: string;
	spouseOccupation?: string;
	spouseStatus?: string;
	motherName?: string;
	motherAge?: number;
	motherBirthDate?: string;
	motherOccupation?: string;
	motherStatus?: string;
	fatherName?: string;
	fatherAge?: number;
	fatherBirthDate?: string;
	fatherOccupation?: string;
	fatherStatus?: string;
	// Add more as needed
}

interface DocumentRequest {
	_id: string;
	type: string;
	status: string;
	dateRequested: string;
	notes?: string;
}

export default function ResidentPortal() {
	const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
	const [residentMissing, setResidentMissing] = useState(false);
	const [showCreateModal, setShowCreateModal] = useState(false);

	const autoCreateResident = async () => {
		try {
			if (!profile) {
				message.error('Profile not yet loaded. Please try again.');
				return;
			}
			// derive minimal name values
			const parts = profile.fullName ? profile.fullName.trim().split(' ') : [];
			const firstName = parts.length ? parts[0] : (profile.username || profile.email || 'Resident');
			const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
			const payload: any = {
				firstName,
				lastName,
				barangayID: profile.barangayID || '',
				username: profile.username || '',
				email: profile.email || ''
			};
			const resp = await axios.put('/api/resident/personal-info', payload);
			setPersonalInfo(resp.data);
			setPersonalForm(resp.data);
			setResidentMissing(false);
			message.success('Resident profile created');
		} catch (err) {
			console.error('Failed to auto-create resident:', err);
			message.error('Failed to create resident info. Please fill the form manually.');
		}
	};

	const { setUser } = useAuth();
	// handle avatar upload for resident portal banner
	const handleBannerAvatarUpload = async (file: File | null) => {
		if (!file) return;
		const reader = new FileReader();
		reader.onload = e => setAvatarPreview(e.target?.result as string);
		reader.readAsDataURL(file);
		const form = new FormData();
		form.append('avatar', file);
		try {
			const resp = await axios.post('/api/resident/personal-info/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
			// server returns { message, resident, user }
			const updated = resp.data?.resident;
			const returnedUser = resp.data?.user;
			if (updated) {
				// Update resident container state so the picture is saved in the resident container
				setPersonalInfo(updated);
				setPersonalForm(updated);
				if (updated.profileImage) {
					const url = updated.profileImage.startsWith('http') ? updated.profileImage : `${window.location.origin}${updated.profileImage}`;
					setAvatarPreview(url);
				}
				setResidentMissing(false);
				message.success('Profile image updated');
			} else {
				message.success('Profile image updated');
			}
			// If server returned an updated user, update AuthContext/localStorage
			if (returnedUser) {
				try {
					if (typeof setUser === 'function') setUser(returnedUser);
					else localStorage.setItem('userProfile', JSON.stringify(returnedUser));
				} catch (err) {
					// ignore
				}

				try {
					const ev = new CustomEvent('userProfileUpdated', { detail: returnedUser });
					window.dispatchEvent(ev);
				} catch (err) {
					// ignore
				}
			}
		} catch (err) {
			message.error('Failed to upload avatar');
		}
	};
	// ...existing code...
	const handleRegisterResident = async () => {
		try {
			// Use form (user info) and personalForm (resident info)
			const payload = {
				barangayID: form?.barangayID || '',
				username: form?.username || '',
				...personalForm
			};
			await axios.post('/resident', payload);
			alert('Resident registered successfully!');
		} catch (error) {
			alert('Failed to register resident.');
		}
	};
	const { t, i18n } = useTranslation();
	const [profile, setProfile] = useState<ResidentProfile | null>(null);
	const [requests, setRequests] = useState<DocumentRequest[]>([]);
	const [editing, setEditing] = useState(false);
	const [form, setForm] = useState<ResidentProfile | null>(null);
	const [staffRequestSent, setStaffRequestSent] = useState(false);
	const [requesting, setRequesting] = useState(false);
	const [editingUser, setEditingUser] = useState(false);
	const [editingPersonal, setEditingPersonal] = useState(false);
	const [personalInfo, setPersonalInfo] = useState<PersonalInfo | null>(null);
	const [personalForm, setPersonalForm] = useState<PersonalInfo | null>(null);
	const [currentTime, setCurrentTime] = useState<string>('');

	useEffect(() => {
    // Fetch resident profile and requests
	axios.get('/api/resident/profile').then((res: AxiosResponse<any>) => {
		setProfile(res.data);
		setForm(res.data);
		if (res.data?.profileImage) {
			const url = res.data.profileImage.startsWith('http') ? res.data.profileImage : `${window.location.origin}${res.data.profileImage}`;
			setAvatarPreview(url);
		}
	});
    residentPersonalInfoAPI.getPersonalInfo()
      .then((data: any) => {
        setPersonalInfo(data);
        setPersonalForm(data);
				if (data?.profileImage) {
						const url = data.profileImage.startsWith('http') ? data.profileImage : `${window.location.origin}${data.profileImage}`;
						setAvatarPreview(url);
				}
      })
			.catch((err: any) => {
				if (err.response && err.response.status === 404) {
					// No personal info yet, show empty form and flag missing
					setResidentMissing(true);
					setPersonalInfo(null);
					setPersonalForm({
            firstName: '',
            lastName: '',
            age: undefined,
            birthDate: '',
            dateOfResidency: '',
            sex: '',
            civilStatus: '',
            facebook: '',
            email: '',
            contactNumber: '',
            emergencyContact: '',
            landlineNumber: '',
            spouseName: '',
            spouseAge: undefined,
            spouseBirthDate: '',
            spouseOccupation: '',
            spouseStatus: '',
            motherName: '',
            motherAge: undefined,
            motherBirthDate: '',
            motherOccupation: '',
            motherStatus: '',
            fatherName: '',
            fatherAge: undefined,
            fatherBirthDate: '',
            fatherOccupation: '',
            fatherStatus: '',
          });
        }
      });
	axios.get('/api/resident/requests').then((res: AxiosResponse<any>) => {
        setRequests(res.data);
    });
}, []);

	useEffect(() => {
		const updateTime = () => {
			const now = new Date();
			const formatted = now.toLocaleString('en-US', {
				year: 'numeric', month: '2-digit', day: '2-digit',
				hour: '2-digit', minute: '2-digit', second: '2-digit',
				hour12: false
			}).replace(/,/g, '');
			setCurrentTime(formatted);
		};
		updateTime();
		const interval = setInterval(updateTime, 1000);
		return () => clearInterval(interval);
	}, []);

	// User info edit logic
	const handleEditUser = () => setEditingUser(true);
	const handleCancelUser = () => {
		setEditingUser(false);
		setForm(profile);
	};
	const handleChangeUser = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (!form) return;
		setForm({ ...form, [e.target.name]: e.target.value });
	};
	const handleSaveUser = async () => {
		if (!form) return;
		try {
			// Build a minimal payload containing only allowed fields the server expects
			const deriveNames = () => {
				let first = (form as any).firstName || '';
				let last = (form as any).lastName || '';
				if ((!first || !last) && profile && (profile as any).fullName) {
					const parts = (profile as any).fullName.trim().split(' ');
					first = first || parts[0] || '';
					last = last || (parts.length > 1 ? parts.slice(1).join(' ') : '');
				}
				// Fallback to username/email if still missing
				first = first || profile?.username || profile?.email || 'Resident';
				last = last || 'User';
				return { first, last };
			};
			const names = deriveNames();
			const payload: any = {
				firstName: names.first,
				lastName: names.last,
				barangayID: form?.barangayID || profile?.barangayID || '',
				email: form?.email || profile?.email || '',
				contactNumber: form?.contactNumber || profile?.contactNumber || '',
				address: form?.address || profile?.address || ''
			};
			const resp = await axios.put('/api/resident/personal-info', payload);
			// Update local profile with returned resident/user fields when available
			if (resp && resp.data) {
				setProfile({ ...profile, ...resp.data });
			} else {
				setProfile({ ...profile, ...payload } as any);
			}
			setEditingUser(false);
			message.success('Profile saved');
		} catch (err: any) {
			console.error('Failed to save user info:', err);
			if (err?.response && err.response.data) {
				const data = err.response.data;
				if (data.errors) {
					// Validation errors
					const msgs = Object.values(data.errors).map((v: any) => v.toString()).join('; ');
					message.error(msgs || data.message || 'Validation error');
				} else {
					message.error(data.message || 'Failed to save');
				}
			} else {
				message.error('Failed to save user info');
			}
		}
	};

	// Personal info edit logic
	const handleEditPersonal = () => setEditingPersonal(true);
	const handleCancelPersonal = () => {
		setEditingPersonal(false);
		setPersonalForm(personalInfo);
	};
	const handleChangePersonal = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		if (!personalForm) return;
		setPersonalForm({ ...personalForm, [e.target.name]: e.target.value });
	};
	const handleSavePersonal = async () => {
		if (!personalForm || !profile?._id) return;
		// Overwrite the existing record for the displayed user
		await residentPersonalInfoAPI.updatePersonalInfo({ ...personalForm, userId: profile._id });
		setPersonalInfo(personalForm);
		setEditingPersonal(false);
	};

	const handleRequestStaff = async () => {
		setRequesting(true);
		try {
			const resp = await axios.post('/api/resident/request-staff-access');
			const serverMsg = resp?.data?.message || 'Request sent to admin for staff access';
			if (resp && (resp.status === 200 || resp.status === 201)) {
				message.success(serverMsg);
				setStaffRequestSent(true);
			} else {
				message.info(serverMsg);
			}
 		} catch (err) {
 			console.error('Request staff access failed:', err);
 			const e: any = err;
 			const serverMsg = e?.response?.data?.message || e?.message || 'Failed to send staff access request';
 			message.error(serverMsg);
 		} finally {
			setRequesting(false);
		}
	};

		// Feedback form state
	// ...existing code...

			return (
					<div className="max-w-3xl mx-auto p-6">
						{/* Resident Portal Banner -> avatar + upload */}
						<Card
							style={{
								background: 'linear-gradient(90deg, #f7f8fa 0%, #e0e7ff 100%)',
								borderRadius: 16,
								boxShadow: '0 4px 24px #40c9ff22',
								marginBottom: 32,
								border: 'none',
								padding: 0,
							}}
							styles={{ body: { padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }}
							variant="outlined"
						>
							<div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
								<div style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
									{avatarPreview ? (
										<img src={avatarPreview} alt="avatar" style={{ width: 96, height: 96, objectFit: 'cover' }} />
																		) : (
																				<AvatarImage user={(() => {
																					let displayUser = profile;
																					if (!displayUser) {
																						try {
																							const stored = localStorage.getItem('userProfile');
																							if (stored) displayUser = JSON.parse(stored);
																						} catch (err) {}
																					}
																					return displayUser;
																				})()} size={96} />
																		)}
								</div>
								<div>
									<Typography.Title level={3} style={{ margin: 0, fontWeight: 800 }}>{profile?.username || profile?.email || 'Resident'}</Typography.Title>
									<Typography.Text type="secondary">Barangay ID: {profile?.barangayID || 'N/A'}</Typography.Text>
									<div style={{ marginTop: 8 }}><Typography.Text type="secondary">{currentTime}</Typography.Text></div>
								</div>
							</div>
							<div>
								<Upload
									showUploadList={false}
									accept="image/*"
									customRequest={async ({ file, onSuccess, onError }) => {
										try {
											await handleBannerAvatarUpload(file as File);
											if (typeof onSuccess === 'function') onSuccess('ok');
										} catch (err) {
											if (typeof onError === 'function') onError(err as any);
										}
									}}
								>
									<Button icon={<UploadOutlined />}>Replace / Upload Profile Picture</Button>
								</Upload>
							</div>
						</Card>
																		{/* Prompt to create resident info if missing */}
																		{residentMissing && (
																			<div style={{ marginBottom: 16 }}>
																				<Alert
																					message="Your resident profile is incomplete"
																					description={
																						<div>
																							<p>We couldn't find your resident information. Please create your resident profile so you can upload documents and profile pictures.</p>
																							<Button type="primary" onClick={() => setShowCreateModal(true)}>Create Resident Info</Button>
																						</div>
																					}
																					showIcon
																				/>
																			</div>
																		)}
																		<ResidentCreateModal
																			visible={showCreateModal}
																			onClose={() => setShowCreateModal(false)}
																			onCreated={(resident: any) => {
																				setPersonalInfo(resident);
																				setPersonalForm(resident);
																				setResidentMissing(false);
																			}}
																			defaultBarangayID={profile?.barangayID || ''}
																			defaultUsername={profile?.username || ''}
																			defaultEmail={profile?.email || ''}
																		/>
																		{/* Resident Tool Tips moved to Dashboard */}
																		{/* User Info Section */}
												<Card
												   style={{
													   background: 'linear-gradient(135deg, #f8fafc 0%, #e3e6f3 40%, #f6f1f7 100%)',
													   borderRadius: 20,
													   boxShadow: '0 8px 32px #bfc7d6cc',
													   marginBottom: 32,
													   border: 'none',
													   backdropFilter: 'blur(2px)',
												   }}
												   styles={{ body: { padding: 40 } }}
												   variant="outlined"
												>
																										 <div style={{ maxWidth: 900, margin: '0 auto' }}>
																											<Typography.Title level={3} style={{
																												fontWeight: 900,
																												marginBottom: 24,
																												letterSpacing: 1,
																												textAlign: 'left',
																												fontSize: 28,
																												background: 'linear-gradient(90deg, #40c9ff, #e81cff)',
																												WebkitBackgroundClip: 'text',
																												WebkitTextFillColor: 'transparent',
																											}}>{t('userInformation')}</Typography.Title>
																											 {form && (
																												 <Form layout="vertical">
															<Row gutter={24}>
																<Col span={12}><Form.Item label={t('username')}><Input name="username" value={form.username} onChange={handleChangeUser} disabled={!editingUser} /></Form.Item></Col>
																<Col span={12}><Form.Item label={t('email')}><Input name="email" value={form.email} onChange={handleChangeUser} disabled={!editingUser} /></Form.Item></Col>
															</Row>
															<Row gutter={24}>
																<Col span={12}><Form.Item label={t('address')}><Input name="address" value={form.address} onChange={handleChangeUser} disabled={!editingUser} /></Form.Item></Col>
																<Col span={12}><Form.Item label={t('contactNumber')}><Input name="contactNumber" value={form.contactNumber} onChange={handleChangeUser} disabled={!editingUser} /></Form.Item></Col>
															</Row>
															<Row gutter={24}>
																<Col span={12}><Form.Item label={t('barangayID') || 'Barangay ID'}><Input name="barangayID" value={form.barangayID} disabled /></Form.Item></Col>
																<Col span={12}><Form.Item label={t('role') || 'Role'}><Input name="role" value={form.role} disabled /></Form.Item></Col>
															</Row>
															<Space style={{ marginTop: 24 }}>
																{editingUser ? (
																	<>
																		<Button type="primary" onClick={handleSaveUser} style={{ background: 'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)', border: 'none', fontWeight: 600 }}>Save</Button>
																		<Button onClick={handleCancelUser}>Cancel</Button>
																	</>
																) : (
																	<Button onClick={handleEditUser} style={{ fontWeight: 600 }}>Edit</Button>
																														 )}
																<Button
																	type="dashed"
																	onClick={handleRequestStaff}
																	disabled={staffRequestSent || requesting}
																	style={{ color: '#341f97', borderColor: '#341f97', fontWeight: 600 }}
																>
																	{staffRequestSent ? 'Request Sent' : 'Request Staff Access'}
																</Button>
															</Space>
														</Form>
													)}
																										 </div>
												</Card>

												{/* Personal Info Section */}
												   {personalForm && (
													<Card
													   style={{
														   background: 'linear-gradient(135deg, #f8fafc 0%, #e3e6f3 40%, #f6f1f7 100%)',
														   borderRadius: 20,
														   boxShadow: '0 8px 32px #bfc7d6cc',
														   marginBottom: 32,
														   border: 'none',
														   backdropFilter: 'blur(2px)',
													   }}
													   styles={{ body: { padding: 40 } }}
													   variant="outlined"
													   >
														   <Form layout="vertical" style={{ maxWidth: 900, margin: '0 auto' }}>
															   {/* Resident Info Main Title */}
															<Typography.Title level={2} style={{
																fontWeight: 900,
																marginBottom: 24,
																letterSpacing: 1,
																textAlign: 'left',
																fontSize: 34,
																background: 'linear-gradient(90deg, #40c9ff, #e81cff)',
																WebkitBackgroundClip: 'text',
																WebkitTextFillColor: 'transparent',
															}}>Resident Information</Typography.Title>
															   {/* Personal Info Subcategory */}
															<Typography.Title level={3} style={{
																fontWeight: 900,
																marginBottom: 16,
																letterSpacing: 1,
																textAlign: 'left',
																fontSize: 24,
																background: 'linear-gradient(90deg, #ffb347, #ff4e50)',
																WebkitBackgroundClip: 'text',
																WebkitTextFillColor: 'transparent',
															}}>Personal Information</Typography.Title>
															   <Row gutter={16}>
																   <Col span={6}><Form.Item label="First Name"><Input name="firstName" value={personalForm.firstName} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Middle Name"><Input name="middleName" value={personalForm.middleName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Last Name"><Input name="lastName" value={personalForm.lastName} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Age"><Input name="age" type="number" value={personalForm.age || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   </Row>
															   <Row gutter={16}>
																   <Col span={6}><Form.Item label="Birth Date"><Input name="birthDate" type="date" value={personalForm.birthDate || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Place of Birth"><Input name="placeOfBirth" value={personalForm.placeOfBirth || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Nationality"><Input name="nationality" value={personalForm.nationality || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Religion"><Input name="religion" value={personalForm.religion || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   </Row>
															   <Row gutter={16}>
																   <Col span={6}><Form.Item label="Date of Residency"><Input name="dateOfResidency" type="date" value={personalForm.dateOfResidency || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Sex">
																		   <Select
																			   value={personalForm.sex || ''}
																			   onChange={value => setPersonalForm(prev => prev ? { ...prev, sex: value } : prev)}
																			   disabled={!editingPersonal}
																		   >
																			   <Select.Option value="">Select</Select.Option>
																			   <Select.Option value="Male">Male</Select.Option>
																			   <Select.Option value="Female">Female</Select.Option>
																			   <Select.Option value="Other">Other</Select.Option>
																		   </Select>
																   </Form.Item></Col>
																   <Col span={6}><Form.Item label="Blood Type"><Input name="bloodType" value={personalForm.bloodType || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Disability Status"><Input name="disabilityStatus" value={personalForm.disabilityStatus || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   </Row>
															   <Row gutter={16}>
																   <Col span={6}><Form.Item label="Passport Number"><Input name="passportNumber" value={personalForm.passportNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Government ID Number"><Input name="governmentIdNumber" value={personalForm.governmentIdNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Occupation"><Input name="occupation" value={personalForm.occupation || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																   <Col span={6}><Form.Item label="Educational Attainment"><Input name="educationalAttainment" value={personalForm.educationalAttainment || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   </Row>
															   <Row gutter={16}>
																   <Col span={8}>
																	   <Form.Item label="Civil Status">
																		   <Select
																			   value={personalForm.civilStatus || ''}
																			   onChange={value => setPersonalForm(prev => prev ? { ...prev, civilStatus: value } : prev)}
																			   disabled={!editingPersonal}
																		   >
																			   <Select.Option value="">Select</Select.Option>
																			   <Select.Option value="Single">Single</Select.Option>
																			   <Select.Option value="Married">Married</Select.Option>
																			   <Select.Option value="Widowed">Widowed</Select.Option>
																			   <Select.Option value="Divorced">Divorced</Select.Option>
																			   <Select.Option value="Separated">Separated</Select.Option>
																			   <Select.Option value="Annulled">Annulled</Select.Option>
																			   <Select.Option value="Domestic Partnership">Domestic Partnership</Select.Option>
																			   <Select.Option value="Other">Other</Select.Option>
																		   </Select>
																	   </Form.Item>
																   </Col>
															   </Row>
															   {/* Social Media Info Subcategory */}
															<Typography.Title level={3} style={{
																fontWeight: 900,
																marginBottom: 16,
																letterSpacing: 1,
																textAlign: 'left',
																fontSize: 24,
																background: 'linear-gradient(90deg, #ffb347, #ff4e50)',
																WebkitBackgroundClip: 'text',
																WebkitTextFillColor: 'transparent',
															}}>Social Media Information</Typography.Title>
															   <Row gutter={16}>
																<Col span={8}><Form.Item label="Facebook"><Input name="facebook" value={personalForm.facebook || ''} onChange={handleChangePersonal} disabled={!editingPersonal} placeholder="Facebook profile/link" /></Form.Item></Col>
																<Col span={8}><Form.Item label="Valid Email"><Input name="email" type="email" value={personalForm.email || ''} onChange={handleChangePersonal} disabled={!editingPersonal} placeholder="Email address" /></Form.Item></Col>
																<Col span={8}><Form.Item label="Contact Number"><Input name="contactNumber" type="number" value={personalForm.contactNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} placeholder="Contact No." /></Form.Item></Col>
															</Row>
															<Row gutter={16}>
																<Col span={8}><Form.Item label="Emergency Contact"><Input name="emergencyContact" type="number" value={personalForm.emergencyContact || ''} onChange={handleChangePersonal} disabled={!editingPersonal} placeholder="Emergency contact number" /></Form.Item></Col>
																<Col span={8}><Form.Item label="Landline Number"><Input name="landlineNumber" type="number" value={personalForm.landlineNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} placeholder="Landline number" /></Form.Item></Col>
															</Row>
														   {/* Family Info Subcategory */}
														<Typography.Title level={3} style={{
															fontWeight: 900,
															marginBottom: 16,
															letterSpacing: 1,
															textAlign: 'left',
															fontSize: 24,
															background: 'linear-gradient(90deg, #ffb347, #ff4e50)',
															WebkitBackgroundClip: 'text',
															WebkitTextFillColor: 'transparent',
														}}>Family Information</Typography.Title>
														   <Row gutter={16}>
															   <Col span={6}><Form.Item label="Spouse Name"><Input name="spouseName" value={personalForm.spouseName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Spouse Middle Name"><Input name="spouseMiddleName" value={personalForm.spouseMiddleName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Spouse Last Name"><Input name="spouseLastName" value={personalForm.spouseLastName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Spouse Age"><Input name="spouseAge" type="number" value={personalForm.spouseAge || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={6}><Form.Item label="Spouse Birthdate"><Input name="spouseBirthDate" type="date" value={personalForm.spouseBirthDate || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Spouse Nationality"><Input name="spouseNationality" value={personalForm.spouseNationality || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Spouse Occupation"><Input name="spouseOccupation" value={personalForm.spouseOccupation || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Spouse Contact Number"><Input name="spouseContactNumber" value={personalForm.spouseContactNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={6}><Form.Item label="Spouse Status">
																	   <Select
																		   value={personalForm.spouseStatus || ''}
																		   onChange={value => setPersonalForm(prev => prev ? { ...prev, spouseStatus: value } : prev)}
																		   disabled={!editingPersonal}
																	   >
																		   <Select.Option value="">Select status</Select.Option>
																		   <Select.Option value="Alive">Alive</Select.Option>
																		   <Select.Option value="Deceased">Deceased</Select.Option>
																		   <Select.Option value="Unknown">Unknown</Select.Option>
																		   <Select.Option value="Missing">Missing</Select.Option>
																		   <Select.Option value="Abroad">Abroad</Select.Option>
																		   <Select.Option value="With Family">With Family</Select.Option>
																		   <Select.Option value="Separated">Separated</Select.Option>
																		   <Select.Option value="Other">Other</Select.Option>
																	   </Select>
															   </Form.Item></Col>
															   <Col span={6}><Form.Item label="Number of Children"><Input name="numberOfChildren" type="number" value={personalForm.numberOfChildren || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Children's Names"><Input name="childrenNames" value={personalForm.childrenNames || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Children's Ages"><Input name="childrenAges" value={personalForm.childrenAges || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={6}><Form.Item label="Emergency Contact Name"><Input name="emergencyContactName" value={personalForm.emergencyContactName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={6}><Form.Item label="Emergency Contact Relationship"><Input name="emergencyContactRelationship" value={personalForm.emergencyContactRelationship || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
															<Row gutter={16}>
																<Col span={8}><Form.Item label="Mother's Name"><Input name="motherName" value={personalForm.motherName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																<Col span={8}><Form.Item label="Mother's Age"><Input name="motherAge" type="number" value={personalForm.motherAge || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																<Col span={8}><Form.Item label="Mother's Birthdate"><Input name="motherBirthDate" type="date" value={personalForm.motherBirthDate || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															</Row>
															<Row gutter={16}>
																<Col span={8}><Form.Item label="Mother's Occupation"><Input name="motherOccupation" value={personalForm.motherOccupation || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																<Col span={8}>
																	<Form.Item label="Mother's Status">
																		<Select
																			value={personalForm.motherStatus || ''}
																			onChange={value => setPersonalForm(prev => prev ? { ...prev, motherStatus: value } : prev)}
																			disabled={!editingPersonal}
																		>
																			<Select.Option value="">Select status</Select.Option>
																			<Select.Option value="Alive">Alive</Select.Option>
																			<Select.Option value="Deceased">Deceased</Select.Option>
																			<Select.Option value="Unknown">Unknown</Select.Option>
																			<Select.Option value="Missing">Missing</Select.Option>
																			<Select.Option value="Abroad">Abroad</Select.Option>
																			<Select.Option value="With Family">With Family</Select.Option>
																			<Select.Option value="Separated">Separated</Select.Option>
																			<Select.Option value="Other">Other</Select.Option>
																		</Select>
																	</Form.Item>
																</Col>
															</Row>
															<Row gutter={16}>
																<Col span={8}><Form.Item label="Father's Name"><Input name="fatherName" value={personalForm.fatherName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																<Col span={8}><Form.Item label="Father's Age"><Input name="fatherAge" type="number" value={personalForm.fatherAge || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																<Col span={8}><Form.Item label="Father's Birthdate"><Input name="fatherBirthDate" type="date" value={personalForm.fatherBirthDate || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															</Row>
															<Row gutter={16}>
																<Col span={8}><Form.Item label="Father's Occupation"><Input name="fatherOccupation" value={personalForm.fatherOccupation || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
																<Col span={8}>
																	<Form.Item label="Father's Status">
																		<Select
																			value={personalForm.fatherStatus || ''}
																			onChange={value => setPersonalForm(prev => prev ? { ...prev, fatherStatus: value } : prev)}
																			disabled={!editingPersonal}
																		>
																			<Select.Option value="">Select status</Select.Option>
																			<Select.Option value="Alive">Alive</Select.Option>
																			<Select.Option value="Deceased">Deceased</Select.Option>
																			<Select.Option value="Unknown">Unknown</Select.Option>
																			<Select.Option value="Missing">Missing</Select.Option>
																			<Select.Option value="Abroad">Abroad</Select.Option>
																			<Select.Option value="With Family">With Family</Select.Option>
																			<Select.Option value="Separated">Separated</Select.Option>
																			<Select.Option value="Other">Other</Select.Option>
																		</Select>
																	</Form.Item>
																</Col>
															</Row>
														   {/* Business Info Subcategory */}
														<Typography.Title level={3} style={{
															fontWeight: 900,
															marginBottom: 16,
															letterSpacing: 1,
															textAlign: 'left',
															fontSize: 24,
															background: 'linear-gradient(90deg, #ffb347, #ff4e50)',
															WebkitBackgroundClip: 'text',
															WebkitTextFillColor: 'transparent',
														}}>Business Information</Typography.Title>
														   <Row gutter={16}>
															   <Col span={8}><Form.Item label="Business Name"><Input name="businessName" value={personalForm.businessName || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Business Type">
																   <Select value={personalForm.businessType || ''} onChange={value => setPersonalForm(prev => prev ? { ...prev, businessType: value } : prev)} disabled={!editingPersonal}>
																	   <Select.Option value="">Select</Select.Option>
																	   <Select.Option value="Sole Proprietorship">Sole Proprietorship</Select.Option>
																	   <Select.Option value="Partnership">Partnership</Select.Option>
																	   <Select.Option value="Corporation">Corporation</Select.Option>
																	   <Select.Option value="Cooperative">Cooperative</Select.Option>
																	   <Select.Option value="Other">Other</Select.Option>
																   </Select>
															   </Form.Item></Col>
															   <Col span={8}><Form.Item label="Nature of Business"><Input name="natureOfBusiness" value={personalForm.natureOfBusiness || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={8}><Form.Item label="Business Address"><Input name="businessAddress" value={personalForm.businessAddress || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Date Established"><Input name="dateEstablished" type="date" value={personalForm.dateEstablished || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="TIN"><Input name="tin" value={personalForm.tin || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={8}><Form.Item label="DTI/SEC/CDA Registration No."><Input name="registrationNumber" value={personalForm.registrationNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Business Permit No."><Input name="businessPermitNumber" value={personalForm.businessPermitNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Barangay Clearance No."><Input name="barangayClearanceNumber" value={personalForm.barangayClearanceNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={8}><Form.Item label="Number of Employees"><Input name="numberOfEmployees" type="number" value={personalForm.numberOfEmployees || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Capital Investment"><Input name="capitalInvestment" type="number" value={personalForm.capitalInvestment || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Annual Gross Income"><Input name="annualGrossIncome" type="number" value={personalForm.annualGrossIncome || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <Row gutter={16}>
															   <Col span={8}><Form.Item label="Contact Person"><Input name="businessContactPerson" value={personalForm.businessContactPerson || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Contact Number"><Input name="businessContactNumber" value={personalForm.businessContactNumber || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
															   <Col span={8}><Form.Item label="Email Address"><Input name="businessEmail" type="email" value={personalForm.businessEmail || ''} onChange={handleChangePersonal} disabled={!editingPersonal} /></Form.Item></Col>
														   </Row>
														   <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
															   {editingPersonal ? (
																   <>
																	   <Button type="primary" onClick={handleSavePersonal} style={{ fontWeight: 600 }}>Save</Button>
																	   <Button onClick={handleCancelPersonal}>Cancel</Button>
																   </>
															   ) : (
																   <>
																	   <Button onClick={handleEditPersonal} style={{ fontWeight: 600, marginRight: 8 }}>Edit</Button>
																	   {personalInfo && personalInfo.barangayID ? (
																			<Button type="primary" disabled style={{ fontWeight: 600, background: '#b2bec3', border: 'none' }}>Registered</Button>
																		) : (
																			<Button type="primary" style={{ fontWeight: 600 }} onClick={handleRegisterResident}>Register</Button>
																	   )}
																   </>
															   )}
														   </div>
														   </Form>
													   </Card>
												)}

			</div>
		);
}
export {};
