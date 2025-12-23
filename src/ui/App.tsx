import Sidebar from "../components/sidebar";
import logo from "../assets/logo.png";
import "./App.css";

export default function App() {
  return (
    <div className="app">
      <Sidebar />

      <div className="content">
        <div className="page">
          <div className="page-top">
            <div>
              <h1>Hello User!</h1>
              <p>
                ___________________________________________________________________________________________________________________________________________________________________________________________________________________________
              </p>
            </div>

            <img src={logo} alt="Logo" className="page-logo" />
          </div>
        </div>
      </div>
    </div>
  );
}
