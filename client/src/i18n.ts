import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "welcome": "Welcome to BIMS!",
      "login": "Sign In",
      "register": "Register",
      "firstName": "First Name",
      "lastName": "Last Name",
      "email": "Email",
      "password": "Password",
      "contactNumber": "Contact Number",
      "address": "Address",
      "editProfile": "Edit Profile",
      "save": "Save",
      "cancel": "Cancel",
      "submitFeedback": "Submit Feedback",
      "residentPortal": "Resident Portal",
      "accountSettings": "Account Settings",
      "home": "Home",
      "profile": "Profile",
      "request": "Request",
      "inquiries": "Inquiries",
      "adminDashboard": "Admin Dashboard",
      "userManagement": "User Management",
      "activityLogs": "Activity Logs",
      "statistics": "Statistics",
      "systemSettings": "System Settings",
      "logout": "Logout",
      "language": "Language",
      "FIL": "FIL",
      "EN": "EN",
      "documentType": "Document Type",
      "status": "Status",
      "dateRequested": "Date Requested",
      "notes": "Notes",
      "edit": "Edit",
      "saveChanges": "Save Changes",
      "cancelEdit": "Cancel Edit",
      "requestStaffAccess": "Request Staff Access",
      "feedback": "Feedback",
      "userInformation": "User Information",
      "personalInformation": "Personal Information",
      "businessInformation": "Business Information",
      "familyInformation": "Family Information",
      "emergencyContact": "Emergency Contact",
      "registrationSuccess": "Resident registered successfully!",
      "registrationFailed": "Failed to register resident."
    }
  },
  fil: {
    translation: {
      "welcome": "Maligayang pagdating sa BIMS!",
      "login": "Mag-sign In",
      "register": "Magrehistro",
      "firstName": "Pangalan",
      "lastName": "Apelyido",
      "email": "Email",
      "password": "Password",
      "contactNumber": "Numero ng Telepono",
      "address": "Address",
      "editProfile": "I-edit ang Profile",
      "save": "I-save",
      "cancel": "Kanselahin",
      "submitFeedback": "Ipasa ang Feedback",
      "residentPortal": "Portal ng Residente",
      "accountSettings": "Mga Setting ng Account",
      "home": "Home",
      "profile": "Profile",
      "request": "Request",
      "inquiries": "Mga Inquiry",
      "adminDashboard": "Admin Dashboard",
      "userManagement": "Pamamahala ng User",
      "activityLogs": "Mga Log ng Aktibidad",
      "statistics": "Istatistika",
      "systemSettings": "Mga Setting ng Sistema",
      "logout": "Mag-logout",
      "language": "Wika",
      "FIL": "FIL",
      "EN": "EN",
      "documentType": "Uri ng Dokumento",
      "status": "Status",
      "dateRequested": "Petsa ng Pag-request",
      "notes": "Tala",
      "edit": "I-edit",
      "saveChanges": "I-save ang mga Pagbabago",
      "cancelEdit": "Kanselahin ang Pag-edit",
      "requestStaffAccess": "Humiling ng Staff Access",
      "feedback": "Feedback",
      "userInformation": "Impormasyon ng User",
      "personalInformation": "Personal na Impormasyon",
      "businessInformation": "Impormasyon ng Negosyo",
      "familyInformation": "Impormasyon ng Pamilya",
      "emergencyContact": "Emergency Contact",
      "registrationSuccess": "Matagumpay na nairehistro ang residente!",
      "registrationFailed": "Nabigong irehistro ang residente."
    }
  }
};

const storedLang = localStorage.getItem('appLanguage');
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: storedLang || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

// Listen for language changes and persist to localStorage
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('appLanguage', lng);
});
export default i18n;
