/* frontend logic for the tutoring booking app*/
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

// 12 hour format for timestamps (could change back to 24)
function formatTime(dateString) {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
// controls the current logged user, page navigation and which dashboard is displayed based on role
function App() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("home");
  //gets user from supabase
  async function getUsers() {
    const { data, error } = await supabase.from("app_user").select("*");
    if (error){
      console.error(error);
    } else{
      setUsers(data || []);
    }
  }
  useEffect(() => {
    getUsers();
  }, []);
  if(!currentUser && page === "home"){
    return <HomePage setPage={setPage} />;
  }
  if (!currentUser && page === "login"){
    return (
      <LoginPage
        users={users}
        setCurrentUser={setCurrentUser}
        setPage={setPage}
        refreshUsers={getUsers}
      />
    );
  }
  return(
    <div className="dashboard-page">
      <div className="logout-wrapper">
        <button
          onClick={() => {
            setCurrentUser(null);
            setPage("login");
          }}
        >
          Logout
        </button>
      </div>
      <div className="dashboard-card">
        <h1>Welcome, {currentUser.name}</h1>
      </div>
      {currentUser.role === "student" && (
        <StudentDashboard user={currentUser} />
      )}
      {currentUser.role === "tutor" && (
        <TutorDashboard user={currentUser} />
      )}
      {currentUser.role === "admin" && (
        <AdminDashboard user={currentUser} />
      )}
    </div>
  );
}

// homepage
function HomePage({setPage}) {
  return(
    <div className="page">
      <div className="home-card">
        <h1>StudySlot</h1>
        <p className="home-subtitle">
          A simple application for students to find tutors, book appointments,
          and manage tutoring sessions.
        </p>
        <div className="home-grid">
          <div className="info-box">
            <h2>For Students</h2>
            <p>
              Search available tutoring slots by course, book appointments, and
              view or cancel your upcoming sessions.
            </p>
          </div>
          <div className="info-box">
            <h2>For Tutors</h2>
            <p>
              Post availability slots, manage booked appointments, and confirm
              or cancel tutoring sessions.
            </p>
          </div>
        </div>
        <button className="primary-button" onClick={() => setPage("login")}>
          Go to Login
        </button>
      </div>
    </div>
  );
}
// login page, where existing users login with email and new users create their student accoutn
function LoginPage({users, setCurrentUser, setPage, refreshUsers}) {
  const [email, setEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  //finds users by their email
  function loginWithEmail(e){
    e.preventDefault();
    const foundUser = users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );

    if (!foundUser){
      alert("No account found with that email!");
      return;
    }
    setCurrentUser(foundUser);
  }
  //creates new account
  async function createAccount(e) {
    e.preventDefault();
    const {data, error} = await supabase
      .from("app_user")
      .insert([
        {
          name: newName,
          email: newEmail,
          role: "student",
        },
      ])
      .select()
      .single();
    if (error) {
      console.error(error);
      alert("Could not create account. Email may already exist.");
      return;
    }
    alert("Account created!");
    await refreshUsers();
    setCurrentUser(data);
  }

  return(
    <div className="page">
      <div className="center-page">
        <div className="top-button">
          <button onClick={() => setPage("home")}>Back to Home</button>
        </div>
        <div className="login-card">
          <h1>Login Page</h1>
          <form onSubmit={loginWithEmail} className="login-row">
            <input
              type="email"
              placeholder="Enter your ASU email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button type="submit">Login</button>
          </form>
          <hr />
          <h2>First Time User?</h2>
          <p>Create a student account below.</p>
          <form onSubmit={createAccount} className="signup-form">
            <input
              placeholder="Full name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="ASU email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
            <button type="submit">Create Student Account</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// student dashboard to view available tutoring slots, search/filter by course and book/cancel appointments
function StudentDashboard({user}) {
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [searchCourse, setSearchCourse] = useState("");
  const filteredSlots = slots.filter((slot) =>
    slot.course?.coursename
      ?.toLowerCase()
      .includes(searchCourse.toLowerCase())
  );
  // gets available slots that are not booked
  async function getAvailableSlots() {
    const { data, error } = await supabase
      .from("availability")
      .select(`
        slotid,
        meetingtype,
        location,
        starttime,
        endtime,
        slotstatus,
        course(courseid, coursename),
        app_user(userid, name, email)
      `)
      .eq("slotstatus", "available")
      .order("starttime", {ascending: true});
    if (error){
      console.error(error);
    } else{
      setSlots(data || []);
    }
  }
  //gets all appointments for the student
  async function getAppointments(){
    const {data, error} = await supabase
      .from("appointment")
      .select(`
        appointmentid,
        status,
        slotid,
        availability(
          slotid,
          meetingtype,
          location,
          starttime,
          endtime,
          course(coursename),
          app_user(name, email)
        )
      `)
      .eq("studentid", user.userid)
      .order("appointmentid", {ascending: false});
    if (error){
      console.error(error);
    } else{
      setAppointments(data || []);
    }
  }
  // books a slot updating status to "booked"
  async function bookSlot(slotid){
    const { error: appointmentError } = await supabase
      .from("appointment")
      .insert([
        {
          studentid: user.userid,
          slotid,
          status: "booked",
        },
      ]);
    if (appointmentError){
      console.error(appointmentError);
      alert("Could not book appointment.");
      return;
    }
    const { error: slotError } = await supabase
      .from("availability")
      .update({ slotstatus: "booked" })
      .eq("slotid", slotid);
    if (slotError){
      console.error(slotError);
      alert("Appointment created, but slot status was not updated.");
      return;
    }
    alert("Appointment booked!");
    getAvailableSlots();
    getAppointments();
  }
  // cancels appointment changing status to "cancelled"
  async function cancelAppointment(appointment){
    const {error: appointmentError} = await supabase
      .from("appointment")
      .update({ status: "cancelled" })
      .eq("appointmentid", appointment.appointmentid);
    if (appointmentError) {
      console.error(appointmentError);
      alert("Could not cancel appointment.");
      return;
    }
    const {error: slotError} = await supabase
      .from("availability")
      .update({ slotstatus: "cancelled" })
      .eq("slotid", appointment.slotid);
    if (slotError){
      console.error(slotError);
      alert("Appointment cancelled, but slot was not closed.");
      return;
    }
    alert("Appointment cancelled.");
    getAvailableSlots();
    getAppointments();
  }

  useEffect(() => {
    getAvailableSlots();
    getAppointments();
  }, []);

  return(
    <div>
      <div className="dashboard-card">
        <h1>Student Dashboard</h1>
        <h2>Available Tutoring Slots</h2>
        <input
          className="search-input"
          type="text"
          placeholder="Search by course name..."
          value={searchCourse}
          onChange={(e) => setSearchCourse(e.target.value)}
        />
        {filteredSlots.length === 0 && <p>No matching available slots.</p>}
        <div className="slot-grid">
          {filteredSlots.map((slot) => (
            <div key={slot.slotid} className="slot-card">
              <p><strong>Course:</strong> {slot.course?.coursename}</p>
              <p><strong>Tutor:</strong> {slot.app_user?.name}</p>
              <p><strong>Meeting:</strong> {slot.meetingtype}</p>
              <p><strong>Location:</strong> {slot.location}</p>
              <p><strong>Start:</strong> {formatTime(slot.starttime)}</p>
              <p><strong>End:</strong> {formatTime(slot.endtime)}</p>
              <button
                className="card-button"
                onClick={() => bookSlot(slot.slotid)}
              >
                Book Appointment
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-card">
        <h2>My Appointments</h2>
        {appointments.length === 0 && <p>You have no appointments yet.</p>}
        <div className="slot-grid">
          {appointments.map((appointment) => (
            <div key={appointment.appointmentid} className="slot-card">
              <p><strong>Status:</strong> {appointment.status}</p>
              <p><strong>Course:</strong> {appointment.availability?.course?.coursename}</p>
              <p><strong>Tutor:</strong> {appointment.availability?.app_user?.name}</p>
              <p><strong>Meeting:</strong> {appointment.availability?.meetingtype}</p>
              <p><strong>Location:</strong> {appointment.availability?.location}</p>
              <p><strong>Start:</strong> {formatTime(appointment.availability?.starttime)}</p>
              <p><strong>End:</strong> {formatTime(appointment.availability?.endtime)}</p>
              {appointment.status !== "cancelled" && (
                <button
                  className="card-button"
                  onClick={() => cancelAppointment(appointment)}
                >
                  Cancel Appointment
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
// tutor dashboard to create availability slots, view own slots and manage appointments to cancel/confirm them
function TutorDashboard({user}){
  const [courses, setCourses] = useState([]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [courseid, setCourseid] = useState("");
  const [meetingtype, setMeetingtype] = useState("online");
  const [location, setLocation] = useState("");
  const [starttime, setStarttime] = useState("");
  const [endtime, setEndtime] = useState("");
  //gets lists of courses, i put as dropdown but a search and select might be better as more courses get added
  async function getCourses(){
    const {data, error} = await supabase
      .from("course")
      .select("*")
      .order("coursename");
    if (error){
      console.error(error);
    } else{
      setCourses(data || []);
    }
  }
  // gets availability slots that arent cancelled
  async function getMySlots(){
    const { data, error } = await supabase
      .from("availability")
      .select(`
        slotid,
        slotstatus,
        meetingtype,
        location,
        starttime,
        endtime,
        course(coursename)
      `)
      .eq("tutorid", user.userid)
      .neq("slotstatus", "cancelled")
      .order("starttime", { ascending: true });
    if (error){
      console.error(error);
    } else{
      setSlots(data || []);
    }
  }
  //gets appointments booked
  async function getMyAppointments(){
    const { data, error } = await supabase
      .from("appointment")
      .select(`
        appointmentid,
        status,
        slotid,
        app_user(name, email),
        availability(
          tutorid,
          meetingtype,
          location,
          starttime,
          endtime,
          course(coursename)
        )
      `)
      .eq("availability.tutorid", user.userid)
      .order("appointmentid", { ascending: false });
    if (error){
      console.error(error);
    } else{
      setAppointments(data || []);
    }
  }
  //creates new availabilty slots
  async function createSlot(e){
    e.preventDefault();
    const {error} = await supabase.from("availability").insert([
      {
        tutorid: user.userid,
        courseid: Number(courseid),
        slotstatus: "available",
        meetingtype,
        location,
        starttime,
        endtime,
      },
    ]);
    if (error){
      console.error(error);
      alert("Could not create slot.");
      return;
    }

    alert("Availability slot created!");
    setCourseid("");
    setMeetingtype("online");
    setLocation("");
    setStarttime("");
    setEndtime("");
    getMySlots();
  }
  // confirms the appointment changing status to "confirmed"
  async function confirmAppointment(appointmentid) {
    const { error } = await supabase
      .from("appointment")
      .update({ status: "confirmed" })
      .eq("appointmentid", appointmentid);
    if (error){
      console.error(error);
      alert("Could not confirm appointment.");
      return;
    }
    alert("Appointment confirmed.");
    getMyAppointments();
  }
  //cancels appointment changing status to "cancel"
  async function cancelAppointment(appointment) {
    const {error: appointmentError} = await supabase
      .from("appointment")
      .update({ status: "cancelled" })
      .eq("appointmentid", appointment.appointmentid);

    if (appointmentError){
      console.error(appointmentError);
      alert("Could not cancel appointment.");
      return;
    }
    const {error: slotError} = await supabase
      .from("availability")
      .update({ slotstatus: "cancelled" })
      .eq("slotid", appointment.slotid);
    if (slotError){
      console.error(slotError);
      alert("Appointment cancelled, but slot was not closed.");
      return;
    }
    alert("Appointment cancelled.");
    getMyAppointments();
    getMySlots();
  }
  useEffect(() => {
    getCourses();
    getMySlots();
    getMyAppointments();
  }, []);

  return(
    <div>
      <div className="dashboard-card">
        <h1>Tutor Dashboard</h1>
        <h2>Create Availability Slot</h2>
        <form onSubmit={createSlot} className="tutor-slot-form">
          <div className="tutor-form-column">
            <select
              value={courseid}
              onChange={(e) => setCourseid(e.target.value)}
              required
            >
              <option value="">Select course</option>
              {courses.map((course) => (
                <option key={course.courseid} value={course.courseid}>
                  {course.coursename}
                </option>
              ))}
            </select>
            <select
              value={meetingtype}
              onChange={(e) => setMeetingtype(e.target.value)}
            >
              <option value="online">Online</option>
              <option value="in_person">In Person</option>
            </select>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Zoom link or room"
              required
            />
          </div>
          <div className="tutor-form-column">
            <label>Start Time:</label>
            <input
              type="datetime-local"
              value={starttime}
              onChange={(e) => setStarttime(e.target.value)}
              required
            />
            <label>End Time:</label>
            <input
              type="datetime-local"
              value={endtime}
              onChange={(e) => setEndtime(e.target.value)}
              required
            />
          </div>
          <button className="full-width" type="submit">
            Create Slot
          </button>
        </form>
      </div>
      <div className="dashboard-card">
        <h2>My Availability Slots</h2>
        {slots.length === 0 && <p>You have no slots yet.</p>}
        <div className="slot-grid">
          {slots.map((slot) => (
            <div key={slot.slotid} className="slot-card">
              <p><strong>Course:</strong> {slot.course?.coursename}</p>
              <p><strong>Status:</strong> {slot.slotstatus}</p>
              <p><strong>Meeting:</strong> {slot.meetingtype}</p>
              <p><strong>Location:</strong> {slot.location}</p>
              <p><strong>Start:</strong> {formatTime(slot.starttime)}</p>
              <p><strong>End:</strong> {formatTime(slot.endtime)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="dashboard-card">
        <h2>My Booked Appointments</h2>
        {appointments.length === 0 && <p>No appointments booked yet.</p>}
        <div className="slot-grid">
          {appointments.map((appointment) => (
            <div key={appointment.appointmentid} className="slot-card">
              <p><strong>Status:</strong> {appointment.status}</p>
              <p><strong>Student:</strong> {appointment.app_user?.name}</p>
              <p><strong>Email:</strong> {appointment.app_user?.email}</p>
              <p><strong>Course:</strong> {appointment.availability?.course?.coursename}</p>
              <p><strong>Meeting:</strong> {appointment.availability?.meetingtype}</p>
              <p><strong>Location:</strong> {appointment.availability?.location}</p>
              <p><strong>Start:</strong> {formatTime(appointment.availability?.starttime)}</p>
              <p><strong>End:</strong> {formatTime(appointment.availability?.endtime)}</p>
              {appointment.status === "booked" && (
                <button
                  className="card-button"
                  onClick={() => confirmAppointment(appointment.appointmentid)}
                >
                  Confirm Appointment
                </button>
              )}
              {appointment.status !== "cancelled" && (
                <button
                  className="card-button"
                  onClick={() => cancelAppointment(appointment)}
                >
                  Cancel Appointment
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// admin dashboard to create users, courses, view all apointments and remove cancelled appointments.
function AdminDashboard(){
  const [appointments, setAppointments] = useState([]);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("tutor");
  const [courseName, setCourseName] = useState("");
  // loads all appointments in the system
  async function loadData(){
    const { data, error } = await supabase
      .from("appointment")
      .select(`
        appointmentid,
        status,
        availability(
          meetingtype,
          location,
          starttime,
          endtime,
          course(coursename),
          app_user(name)
        ),
        app_user(name)
      `);

    if (error){
      console.error(error);
    } else{
      setAppointments(data || []);
    }
  }
  // creates user with selected role
  async function createUser(e){
    e.preventDefault();
    const {error} = await supabase.from("app_user").insert([
      {
        name: newName,
        email: newEmail,
        role: newRole,
      },
    ]);
    if (error){
      console.error(error);
      alert("Error creating user");
      return;
    }
    alert("User created");
    setNewName("");
    setNewEmail("");
    setNewRole("tutor");
  }
  //creates new course
  async function createCourse(e) {
    e.preventDefault();
    const {error} = await supabase.from("course").insert([
      {
        coursename: courseName,
      },
    ]);

    if (error){
      console.error(error);
      alert("Error creating course");
      return;
    }
    alert("Course created");
    setCourseName("");
  }
  // deletes cancelled appointments from database
  async function deleteCancelledAppointment(appointmentid){
    const {error} = await supabase
      .from("appointment")
      .delete()
      .eq("appointmentid", appointmentid)
      .eq("status", "cancelled");

    if (error){
      console.error(error);
      alert("Could not remove cancelled appointment.");
      return;
    }
    alert("Cancelled appointment removed.");
    loadData();
  }
  useEffect(() => {
    loadData();
  }, []);
  return(
    <div>
      <div className="dashboard-card">
        <h1>Admin Dashboard</h1>
        <div className="admin-two-column">
          <div>
            <h2>Create User</h2>
            <form onSubmit={createUser} className="signup-form">
              <input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
              />
              <input
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
              >
                <option value="student">Student</option>
                <option value="tutor">Tutor</option>
                <option value="admin">Admin</option>
              </select>
              <button type="submit">Create User</button>
            </form>
          </div>
          <div>
            <h2>Create Course</h2>
            <form onSubmit={createCourse} className="signup-form">
              <input
                placeholder="Course Name"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                required
              />
              <button type="submit">Add Course</button>
            </form>
          </div>
        </div>
      </div>
      <div className="dashboard-card">
        <h2>All Appointments</h2>
        {appointments.length === 0 && <p>No appointments found.</p>}
        <div className="slot-grid">
          {appointments.map((appt) => (
            <div key={appt.appointmentid} className="slot-card">
              <p><strong>Status:</strong> {appt.status}</p>
              <p><strong>Student:</strong> {appt.app_user?.name}</p>
              <p><strong>Course:</strong> {appt.availability?.course?.coursename}</p>
              <p><strong>Tutor:</strong> {appt.availability?.app_user?.name}</p>
              <p><strong>Start:</strong> {formatTime(appt.availability?.starttime)}</p>
              <p><strong>End:</strong> {formatTime(appt.availability?.endtime)}</p>
              {appt.status === "cancelled" && (
                <button
                  className="card-button"
                  onClick={() =>
                    deleteCancelledAppointment(appt.appointmentid)
                  }
                >
                  Remove Cancelled Appointment
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
export default App;
