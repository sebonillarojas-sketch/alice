import { AuthProvider, useAuth } from "./auth/AuthContext.jsx";
import LoginScreen from "./auth/LoginScreen.jsx";
import HyggeOS from "./HyggeOS.jsx";

function Gate() {
  const { user, loaded } = useAuth();
  if (!loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#EEEBE3" }}>
        <div style={{ fontSize: 11, color: "#6B6863", letterSpacing: "0.12em", textTransform: "uppercase" }}>Cargando...</div>
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <HyggeOS authUser={user} />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
