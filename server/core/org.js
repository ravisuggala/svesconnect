// Organisation constants shared by migration and routes.
const COLLEGES = [
  { code: "CENTRAL", name: "SVES Central Administration", city: "Bhimavaram", central: 1 },
  { code: "VWU", name: "Vishnu Women's University", city: "Bhimavaram" },
  { code: "VIT", name: "Vishnu Institute of Technology", city: "Bhimavaram" },
  { code: "SVCP", name: "Shri Vishnu College of Pharmacy", city: "Bhimavaram" },
  { code: "VDC", name: "Vishnu Dental College", city: "Bhimavaram" },
  { code: "BVRC", name: "B. V. Raju College", city: "Bhimavaram" },
  { code: "SBSP", name: "Smt. B. Seetha Polytechnic", city: "Bhimavaram" },
  { code: "BVRIT", name: "B. V. Raju Institute of Technology", city: "Narsapur" },
  { code: "VIPER", name: "Vishnu Institute of Pharmaceutical Education and Research", city: "Narsapur" },
  { code: "BVRITH", name: "BVRIT Hyderabad College of Engineering for Women", city: "Hyderabad" },
  { code: "VSCH", name: "Vishnu School", city: "Bhimavaram" },
];

// Hierarchy: admin creates/resets principals, principals create HODs, HODs create lab coordinators (role lab_incharge).
const CHILD_ROLE = { admin: "principal", principal: "hod", hod: "lab_incharge" };

// Initial password for every account created by the hierarchy; users must change it at first login.
const defaultPassword = () => process.env.DEFAULT_PASSWORD || "svesconnect@123";
const principalEmail = (code) => `principal.${code.toLowerCase()}@svesconnect.in`;

module.exports = { COLLEGES, CHILD_ROLE, defaultPassword, principalEmail };
