"use client";
import styles from "./page.module.css";
import Header from "./components/header";
import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";


import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";


export default function Home() {
  const [email, setEmail] = useState("");
  const [isotp, setIsOtp] = useState(false);
  const [isresend, setIsResend] = useState(false);
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, seterror] = useState("");
  const [errortimeout, seterrorTimeout] = useState(5);

  const router = useRouter();

  

  // countdown logic
  useEffect(() => {
    if (countdown === 0) {
      setIsResend(true);
    }
    if (isotp && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, isotp]);

  useEffect(() => {
    if (errortimeout === 0) {
      seterror("");
      setCountdown(5);
    }
    if (error && errortimeout > 0) {
      const timer = setTimeout(() => seterrorTimeout(errortimeout - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [error, errortimeout]);

  const handleLogin = async () => {
    try{

      if (!email) {
      seterror("Email is required");
      seterrorTimeout(5);
      return;
    }

    setLoading(true);
   const response = await axios.post(

  `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/request_otp`,{ email },{withCredentials:true});

    if(response.data.emessage){
      seterror(response.data.emessage);
      seterrorTimeout(10);
      setLoading(false);
      return;
    }
    if(response.data.status === 'success'){
      setIsOtp(true);
      setLoading(false);
      setCountdown(60);
    }

    }catch(err){
      console.log(err);
      seterror("Failed to send OTP. Please try again.");
      seterrorTimeout(5);
      setLoading(false);
      return;
    }finally{
      setLoading(false);
    }
    
  };

  const handleVerify = async () => {
    try{

      if (!otp) {
      seterror("OTP is required");
      seterrorTimeout(5);
      return;
    }

    setLoading(true);
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/verify_otp`,
      { email, otp },{withCredentials:true}
    );
    if(response.data.emessage){
      seterror(response.data.emessage);
      seterrorTimeout(5);
      setLoading(false);
      return;
    }
    if(response.data.status === 'success'){
      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("role", response.data.role);
      
      const role = response.data.role;
      if(response.data.status === "success"){
          sessionStorage.setItem("isLoggedIn", "true");
          const role = response.data.role;
          sessionStorage.setItem("role", response.data.role);
          
          if(role === "admin"){
          router.push("/admin");
          }else if (role === "student"){
            router.push("/student");
          }else if(role=== "staff"){
            router.push("/staff");
          }else{
            seterror("Unknown user role");
            seterrorTimeout(5);
            setLoading(false);
            return;
          }
        }


    }

    }catch(err){
      console.log(err);
      seterror("Failed to verify OTP. Please try again.");
      seterrorTimeout(5);
      setLoading(false);
      return;
    }finally{
      setLoading(false);
    }
    
    
  };


  const handleResend = () => {
    handleLogin();
    setIsResend(false);
    setCountdown(30);
  };


const handleGoogleSuccess = async (credentialResponse) => {
    try {
        setLoading(true);
        const { credential } =credentialResponse;

        const response = await axios.post(
            `${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/verify_google`,
            {token: credential},{withCredentials:true}
        );
        
        const data = response.data;
        if(data.emessage){
            seterror(data.emessage);
            seterrorTimeout(5);
            setLoading(false);
            return;

        }
        if(data.profile_image){
          sessionStorage.setItem("profileImage", data.profile_image);
        }
        if(data.status === "success"){
          sessionStorage.setItem("isLoggedIn", "true");
          const role = data.role;
          sessionStorage.setItem("role", data.role);
          if(role === "admin"){
          router.push("/admin");
          }else if (role === "student"){
            router.push("/student");
          }else if(role=== "staff"){
            router.push("/staff");
          }else{
            seterror("Unknown user role");
            seterrorTimeout(5);
            setLoading(false);
            return;
          }
        }
        console.log("Welcome", data.user);

    } catch (err) {
        console.log(err);
        seterror(
            err.response?.data?.emessage ||
            "Google login failed"
        );
        seterrorTimeout(5);
    } finally {
        setLoading(false);
    }
};

  return (
    // 2. Wrap your application content in the Provider and pass the Client ID
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
      <Header />
      <div className={styles.wrapper}>
        {error && (
          <div className={styles.error}>
            <span className={styles.errorIcon}>⚠️</span>
            <p>{error}</p>
            <button onClick={() => seterror("")}>✕</button>
          </div>
        )}
        <div className={styles.card}>
          <h1 className={styles.title}>
            Welcome back <span>👋</span>
          </h1>
          <p className={styles.subtitle}>Sign in to your college portal account</p>

          {/* Step Indicator */}
          <div className={styles.steps}>
            <div className={!isotp ? styles.stepActive : styles.stepDone}>1</div>
            <span className={!isotp ? "" : styles.doneText}>Email</span>

            <div className={styles.line}></div>

            <div className={isotp ? styles.stepActive : styles.stepInactive}>2</div>
            <span className={isotp ? "" : styles.inactiveText}>Verify OTP</span>
          </div>

          {!isotp ? (
            <div className={styles.form}>
              <label>College Email Address</label>

              <input
                className={styles.darkInput}
                type="email"
                placeholder="you@college.edu.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <button
                className={styles.primaryBtn}
                onClick={handleLogin}
                disabled={loading}
              >
                {loading ? "Sending..." : "Send OTP →"}
              </button>

              <div className={styles.divider} disabled={loading}>
                
                <span>Continue with Google</span>
              </div>

              {/* Actual Google Login Component */}
              <div
  style={{
    display: "flex",
    justifyContent: "center"
  }}
>

  {loading ? (

    <button
      style={{
        padding: "10px 20px",
        borderRadius: "999px",
        border: "1px solid #ddd",
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        fontSize: "14px",
        cursor: "not-allowed"
      }}
      disabled
    >

      <div
        style={{
          width: "16px",
          height: "16px",
          border: "2px solid #ccc",
          borderTop: "2px solid #333",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}
      />

      Signing in...

    </button>

  ) : (

    <GoogleLogin
      onSuccess={handleGoogleSuccess}

      onError={() => {
        seterror(
          "Google signin failed."
        );

        seterrorTimeout(5);
        setLoading(false);
      }}
      onClick={() => setLoading(true)}
      theme="filled_white"

      shape="pill"

      text="continue_with"

      ux_mode="popup"
    />

  )}

</div>
            </div>
          ) : (
            <div className={styles.form}>
              <label>Enter OTP</label>

              <input
                className={styles.darkInput}
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              {isresend ? (
                <button
                  className={styles.resend}
                  onClick={handleResend}
                  disabled={countdown > 0}
                >
                  Resend OTP
                </button>
              ) : (
                <p className={styles.timer}>Resend OTP in {countdown}s</p>
              )}

              <button
                className={styles.primaryBtn}
                onClick={handleVerify}
                disabled={loading}
              >
                {loading ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          )}
        </div>
      </div>
    </GoogleOAuthProvider>
  );
}