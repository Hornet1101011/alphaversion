import { Schema, model, Document as MongooseDocument } from 'mongoose';

export interface IResident extends MongooseDocument {
  barangayID: string;
  userId?: any;
  username?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  age?: number;
  birthDate?: string;
  placeOfBirth?: string;
  nationality?: string;
  religion?: string;
  maritalStatus?: string;
  passportNumber?: string;
  governmentIdNumber?: string;
  bloodType?: string;
  disabilityStatus?: string;
  occupation?: string;
  educationalAttainment?: string;
  sex?: string;
  civilStatus?: string;
  dateOfResidency?: string;
  address?: string;
  facebook?: string;
  email?: string;
  contactNumber?: string;
  emergencyContact?: string;
  landlineNumber?: string;
  spouseName?: string;
  spouseMiddleName?: string;
  spouseLastName?: string;
  spouseAge?: number;
  spouseBirthDate?: string;
  spouseNationality?: string;
  spouseOccupation?: string;
  spouseStatus?: string;
  spouseContactNumber?: string;
  numberOfChildren?: number;
  childrenNames?: string;
  childrenAges?: string;
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
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
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
  profileImage?: string;
  profileImageId?: string;
}
const ResidentSchema = new Schema<IResident>({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  barangayID: { type: String, required: true },
  username: { type: String },
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  age: { type: Number },
  birthDate: { type: String },
  placeOfBirth: { type: String },
  nationality: { type: String },
  religion: { type: String },
  maritalStatus: { type: String },
  passportNumber: { type: String },
  governmentIdNumber: { type: String },
  bloodType: { type: String },
  disabilityStatus: { type: String },
  occupation: { type: String },
  educationalAttainment: { type: String },
  sex: { type: String },
  civilStatus: { type: String },
  dateOfResidency: { type: String },
  address: { type: String },
  facebook: { type: String },
  email: { type: String },
  contactNumber: { type: String },
  emergencyContact: { type: String },
  landlineNumber: { type: String },
  spouseName: { type: String },
  spouseMiddleName: { type: String },
  spouseLastName: { type: String },
  spouseAge: { type: Number },
  spouseBirthDate: { type: String },
  spouseNationality: { type: String },
  spouseOccupation: { type: String },
  spouseStatus: { type: String },
  spouseContactNumber: { type: String },
  numberOfChildren: { type: Number },
  childrenNames: { type: String },
  childrenAges: { type: String },
  motherName: { type: String },
  motherAge: { type: Number },
  motherBirthDate: { type: String },
  motherOccupation: { type: String },
  motherStatus: { type: String },
  fatherName: { type: String },
  fatherAge: { type: Number },
  fatherBirthDate: { type: String },
  fatherOccupation: { type: String },
  fatherStatus: { type: String },
  emergencyContactName: { type: String },
  emergencyContactRelationship: { type: String },
  businessName: { type: String },
  businessType: { type: String },
  natureOfBusiness: { type: String },
  businessAddress: { type: String },
  dateEstablished: { type: String },
  tin: { type: String },
  registrationNumber: { type: String },
  businessPermitNumber: { type: String },
  barangayClearanceNumber: { type: String },
  numberOfEmployees: { type: Number },
  capitalInvestment: { type: Number },
  annualGrossIncome: { type: Number },
  businessContactPerson: { type: String },
  businessContactNumber: { type: String },
  businessEmail: { type: String }
  ,
  profileImage: { type: String }
  ,
  profileImageId: { type: String }
});
// enable timestamps to populate createdAt/updatedAt on new documents
ResidentSchema.set('timestamps', true);
// Add indexes to help enforce uniqueness and avoid duplicates at the database level.
// Use partialFilterExpression so null/missing values don't block index creation for optional fields.
ResidentSchema.index({ barangayID: 1 }, { unique: true, partialFilterExpression: { barangayID: { $exists: true, $ne: null } }, background: true });
ResidentSchema.index({ username: 1 }, { unique: true, sparse: true, background: true });
ResidentSchema.index({ email: 1 }, { unique: true, sparse: true, background: true });

export const Resident = model<IResident>('Resident', ResidentSchema);
