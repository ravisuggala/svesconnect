// Organisation constants shared by migration and routes.
const COLLEGES = [
  { code: "CENTRAL", name: "SVES Central Administration", city: "Bhimavaram", central: 1 },
  { code: "VWU", principal: "principal@svecw.edu.in", name: "Vishnu Women's University", city: "Bhimavaram" },
  { code: "VIT", principal: "principal@vishnu.edu.in", name: "Vishnu Institute of Technology", city: "Bhimavaram" },
  { code: "SVCP", principal: "principal@svcp.edu.in", name: "Shri Vishnu College of Pharmacy", city: "Bhimavaram" },
  { code: "VDC", principal: "principal@vdc.edu.in", name: "Vishnu Dental College", city: "Bhimavaram" },
  { code: "BVRC", principal: "principal@bvricedegree.edu.in", name: "B. V. Raju College", city: "Bhimavaram" },
  { code: "SBSP", principal: "principal@sbspolytechnic.edu.in", name: "Smt. B. Seetha Polytechnic", city: "Bhimavaram" },
  { code: "BVRIT", principal: "principal@bvrit.ac.in", name: "B. V. Raju Institute of Technology", city: "Narsapur" },
  { code: "VIPER", principal: "principal@viper.ac.in", name: "Vishnu Institute of Pharmaceutical Education and Research", city: "Narsapur" },
  { code: "BVRITH", principal: "principal@bvrithyderabad.edu.in", name: "BVRIT Hyderabad College of Engineering for Women", city: "Hyderabad" },
  { code: "VSCH", principal: "principal@vishnuschool.edu.in", name: "Vishnu School", city: "Bhimavaram" },
];

// Hierarchy: admin creates/resets principals, principals create HODs, HODs create lab coordinators (role lab_incharge).
const CHILD_ROLE = { admin: "principal", principal: "hod", hod: "lab_incharge" };

// Initial password for every account created by the hierarchy; users must change it at first login.
const defaultPassword = () => process.env.DEFAULT_PASSWORD || "svesconnect@123";

module.exports = { COLLEGES, CHILD_ROLE, defaultPassword };
