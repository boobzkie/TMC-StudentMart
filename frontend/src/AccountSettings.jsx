import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Archive, BadgeCheck, Bell, BriefcaseBusiness, Camera, CheckCircle2, Eye, EyeOff,
  KeyRound, LockKeyhole, Mail, Package, Phone, Save, ShieldCheck,
  Settings, UserRound, UsersRound,
} from "lucide-react";
import AdminLayout from "./components/AdminLayout";
import AdminPageHero from "./components/AdminPageHero";
import { API_URL, SERVER_URL, getAuthHeaders } from "./utils/api";
import "./AccountSettings.css";

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
}

function makeProfileForm(user) {
  const staff = user.staff_profile || {};
  const name = String(user.name || "").trim().split(/\s+/).filter(Boolean);
  return {
    name: user.name || "",
    first_name: staff.first_name || name[0] || "",
    middle_name: staff.middle_name || "",
    last_name: staff.last_name || (name.length > 1 ? name.slice(1).join(" ") : ""),
    suffix: staff.suffix || "",
    date_of_birth: staff.date_of_birth || "",
    contact_number: user.contact_number || "",
    email_notifications_enabled: user.email_notifications_enabled === true,
    in_app_notifications_enabled: user.in_app_notifications_enabled !== false,
  };
}

function photoUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return SERVER_URL.replace(/\/+$/, "") + "/storage/" + String(path).replace(/^\/+/, "");
}

function errorMessage(data, fallback) {
  if (data?.errors) {
    const messages = Object.values(data.errors).flat().filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return data?.message || fallback;
}

function archiveDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const [user, setUser] = useState(readStoredUser);
  const [form, setForm] = useState(() => makeProfileForm(readStoredUser()));
  const [section, setSection] = useState("account");
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [profileSuccess, setProfileSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [archivedStaff, setArchivedStaff] = useState([]);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [archivesError, setArchivesError] = useState("");
  const [restoringProductId, setRestoringProductId] = useState(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwords, setPasswords] = useState({
    current_password: "", password: "", password_confirmation: "",
  });
  const [accountFormFocused, setAccountFormFocused] = useState(false);
  const archiveRequestSequenceRef = useRef(0);
  const userRequestSequenceRef = useRef(0);

  useEffect(() => () => {
    if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);
  const isStaff = String(user.role || localStorage.getItem("role") || "").toLowerCase() === "staff";

  const signOut = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  }, [navigate]);

  const loadArchives = useCallback(async (signal, background = false) => {
    if (signal?.aborted) return;
    const requestSequence = ++archiveRequestSequenceRef.current;
    if (!background) setArchivesLoading(true);
    setArchivesError("");
    try {
      const [productResponse, staffResponse] = await Promise.all([
        fetch(API_URL + "/admin/products?status=archived", { headers: getAuthHeaders(), ...(signal ? { signal } : {}) }),
        fetch(API_URL + "/admin/staff?status=archived&per_page=100", { headers: getAuthHeaders(), ...(signal ? { signal } : {}) }),
      ]);
      if (signal?.aborted || requestSequence !== archiveRequestSequenceRef.current) return;
      if (productResponse.status === 401 || staffResponse.status === 401) {
        signOut();
        return;
      }
      const [productData, staffData] = await Promise.all([
        productResponse.json(),
        staffResponse.json(),
      ]);
      if (!productResponse.ok) throw new Error(errorMessage(productData, "Unable to load archived products."));
      if (!staffResponse.ok) throw new Error(errorMessage(staffData, "Unable to load archived Staff accounts."));
      const lastPage = Math.max(1, Number(staffData.pagination?.last_page) || 1);
      const remainingPages = await Promise.all(Array.from({ length: lastPage - 1 }, (_, index) => {
        const params = new URLSearchParams({ status: "archived", per_page: "100", page: String(index + 2) });
        return fetch(API_URL + "/admin/staff?" + params.toString(), { headers: getAuthHeaders(), ...(signal ? { signal } : {}) });
      }));
      if (signal?.aborted || requestSequence !== archiveRequestSequenceRef.current) return;
      if (remainingPages.some((response) => response.status === 401)) {
        signOut();
        return;
      }
      const remainingData = await Promise.all(remainingPages.map((response) => response.json()));
      if (signal?.aborted || requestSequence !== archiveRequestSequenceRef.current) return;
      const failedPage = remainingPages.findIndex((response) => !response.ok);
      if (failedPage !== -1) {
        throw new Error(errorMessage(remainingData[failedPage], "Unable to load all archived Staff accounts."));
      }
      setArchivedProducts(Array.isArray(productData.products) ? productData.products : []);
      setArchivedStaff([
        ...(Array.isArray(staffData.staff) ? staffData.staff : []),
        ...remainingData.flatMap((page) => Array.isArray(page.staff) ? page.staff : []),
      ]);
    } catch (error) {
      if (!signal?.aborted && error?.name !== "AbortError" && requestSequence === archiveRequestSequenceRef.current) {
        setArchivesError(error.message || "Unable to load archived records.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === archiveRequestSequenceRef.current && !background) setArchivesLoading(false);
    }
  }, [signOut]);

  const handleRestoreProduct = async (productId) => {
    if (!window.confirm("Restore this archived product for moderation review? It will not return to the marketplace until approved.")) {
      return;
    }
    setRestoringProductId(productId);
    setArchivesError("");
    try {
      const response = await fetch(API_URL + "/admin/products/" + productId + "/restore", {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        signOut();
        return;
      }
      if (!response.ok) {
        throw new Error(errorMessage(data, "Unable to restore product."));
      }
      setArchivedProducts((current) => current.filter((product) => product.id !== productId));
    } catch (error) {
      setArchivesError(error.message || "Unable to restore product.");
    } finally {
      setRestoringProductId(null);
    }
  };

  const selectSection = (nextSection) => {
    setSection(nextSection);
    if (nextSection === "archives" && !isStaff) loadArchives();
  };

  const loadUser = useCallback(async (signal, background = false) => {
    if (signal?.aborted) return;
    const requestSequence = ++userRequestSequenceRef.current;
    try {
      setProfileError("");
      if (!background) setLoading(true);
      const response = await fetch(API_URL + "/user", { headers: getAuthHeaders(), ...(signal ? { signal } : {}) });
      if (signal?.aborted || requestSequence !== userRequestSequenceRef.current) return;
      if (response.status === 401) {
        signOut();
        return;
      }
      const data = await response.json();
      if (signal?.aborted || requestSequence !== userRequestSequenceRef.current) return;
      if (!response.ok || !data.user) throw new Error(errorMessage(data, "Unable to load your account details."));
      setUser(data.user);
      setForm(makeProfileForm(data.user));
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("tmc-user-updated"));
    } catch (error) {
      if (!signal?.aborted && error?.name !== "AbortError" && requestSequence === userRequestSequenceRef.current) {
        setProfileError(error.message || "Unable to load your account details.");
      }
    } finally {
      if (!signal?.aborted && requestSequence === userRequestSequenceRef.current && !background) setLoading(false);
    }
  }, [signOut]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => loadUser(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadUser]);

  const hasProfileChanges = JSON.stringify(form) !== JSON.stringify(makeProfileForm(user)) || Boolean(photo);
  const hasUnsavedChanges = hasProfileChanges || Object.values(passwords).some(Boolean);
  const refreshSettings = async (signal) => {
    if (signal?.aborted) return;
    if (section === "archives" && !isStaff) {
      await loadArchives(signal, Boolean(signal));
      return;
    }
    await loadUser(signal, Boolean(signal));
  };

  const updateProfileField = (event) => {
    const { name, type, value, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
    setProfileError("");
    setProfileSuccess("");
    setProfileFieldErrors((current) => {
      const next = { ...current };
      delete next[name];
      return next;
    });
  };

  const handlePhotoChange = (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    const hasSupportedFormat = allowedTypes.includes(selectedFile.type)
      || (!selectedFile.type && /\.(jpe?g|png|webp)$/i.test(selectedFile.name));
    const validationMessage = !hasSupportedFormat
      ? "Choose a JPG, PNG, or WEBP image."
      : selectedFile.size > 2 * 1024 * 1024
        ? "Choose an image that is 2 MB or smaller."
        : "";

    setProfileSuccess("");
    if (validationMessage) {
      setPhoto(null);
      setPhotoPreview("");
      setProfileError(validationMessage);
      setProfileFieldErrors((current) => ({ ...current, profile_picture: [validationMessage] }));
      return;
    }

    setPhoto(selectedFile);
    setPhotoPreview(URL.createObjectURL(selectedFile));
    setProfileError("");
    setProfileFieldErrors((current) => {
      const next = { ...current };
      delete next.profile_picture;
      return next;
    });
  };

  const cancelProfileChanges = () => {
    setForm(makeProfileForm(user));
    setPhoto(null);
    setPhotoPreview("");
    setProfileError("");
    setProfileSuccess("");
    setProfileFieldErrors({});
  };

  const getProfileFieldError = (fieldName) => {
    const messages = profileFieldErrors[fieldName];
    return Array.isArray(messages) ? (messages[0] || "") : (messages || "");
  };

  const profileFieldAccessibility = (fieldName) => {
    const hasError = Boolean(getProfileFieldError(fieldName));
    return {
      "aria-invalid": hasError,
      "aria-describedby": hasError ? "account-field-error-" + fieldName : undefined,
    };
  };

  const renderProfileFieldError = (fieldName) => {
    const message = getProfileFieldError(fieldName);
    return message ? <small className="account-field-error" id={"account-field-error-" + fieldName}>{message}</small> : null;
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    setProfileFieldErrors({});
    setSavingProfile(true);
    const payload = new FormData();
    if (isStaff) {
      payload.append("first_name", form.first_name.trim());
      payload.append("middle_name", form.middle_name.trim());
      payload.append("last_name", form.last_name.trim());
      payload.append("suffix", form.suffix.trim());
      if (form.date_of_birth) payload.append("date_of_birth", form.date_of_birth);
    } else {
      payload.append("name", form.name.trim());
    }
    payload.append("contact_number", form.contact_number.trim());
    payload.append("email_notifications_enabled", form.email_notifications_enabled ? "1" : "0");
    payload.append("in_app_notifications_enabled", form.in_app_notifications_enabled ? "1" : "0");
    if (photo) payload.append("profile_picture", photo);

    try {
      const response = await fetch(API_URL + "/user/profile", {
        method: "POST", headers: getAuthHeaders(), body: payload,
      });
      if (response.status === 401) {
        signOut();
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.user) {
        setProfileFieldErrors(data.errors || {});
        throw new Error(errorMessage(data, "Unable to save your profile."));
      }
      setUser(data.user);
      setForm(makeProfileForm(data.user));
      setPhoto(null);
      setPhotoPreview("");
      setProfileFieldErrors({});
      localStorage.setItem("user", JSON.stringify(data.user));
      window.dispatchEvent(new Event("tmc-user-updated"));
      setProfileSuccess("Your profile information has been saved.");
    } catch (error) {
      setProfileError(error.message || "Unable to save your profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePasswordField = (event) => {
    const { name, value } = event.target;
    setPasswords((current) => ({ ...current, [name]: value }));
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    setSavingPassword(true);
    try {
      const response = await fetch(API_URL + "/user/password", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      });
      if (response.status === 401) {
        signOut();
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(errorMessage(data, "Unable to change your password."));
      setPasswords({ current_password: "", password: "", password_confirmation: "" });
      setPasswordSuccess(data.message || "Your password has been updated.");
    } catch (error) {
      setPasswordError(error.message || "Unable to change your password.");
    } finally {
      setSavingPassword(false);
    }
  };

  const status = String(user.status || "unknown");
  const displayName = user.name || (isStaff ? "Staff Member" : "Administrator");
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const image = photoUrl(user.profile_picture);
  const previewImage = photoPreview || image;
  const roleLabel = user.role === "admin" ? "Administrator" : user.role === "staff" ? "Staff" : String(user.role || "Unknown");
  const statusLabel = status === "unknown" ? "Unknown" : status.charAt(0).toUpperCase() + status.slice(1);
  const staff = user.staff_profile || {};

  return (
    <AdminLayout title="Account Settings" subtitle="Manage your personal information and login security.">
      <section className="account-settings-page">
        <AdminPageHero
          title="Account Settings"
          description="Manage your profile, sign-in security, and archived records available to your account."
          icon={Settings}
          onRefresh={refreshSettings}
          refreshing={loading || archivesLoading || savingProfile || savingPassword || restoringProductId !== null}
          refreshDisabled={hasUnsavedChanges}
          autoRefreshIntervalMs={120_000}
          autoRefreshKey={section}
          autoRefreshPaused={hasUnsavedChanges || accountFormFocused || savingProfile || savingPassword || restoringProductId !== null}
        />

        {loading && <div className="account-settings-notice" role="status">Loading account details…</div>}

        <div className="account-settings-layout">
          <aside className="account-settings-sidebar">
            <section className="account-profile-card" aria-label="Account summary">
              <div className="account-profile-avatar">
                {previewImage && <img src={previewImage} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                <span>{initials || "TM"}</span>
              </div>
              <h3>{displayName}</h3>
              <p>{user.email || "Email address unavailable"}</p>
              <div className="account-profile-badges">
                <span><ShieldCheck size={14} aria-hidden="true" />{isStaff ? "Staff" : "Administrator"}</span>
                <span className={"account-status-badge " + status.toLowerCase()}><BadgeCheck size={14} aria-hidden="true" />{status}</span>
              </div>
            </section>

            <nav className="account-settings-tabs" aria-label="Account settings sections" role="tablist">
              <button type="button" role="tab" aria-selected={section === "account"} className={section === "account" ? "active" : ""} onClick={() => selectSection("account")}>
                <UserRound size={18} aria-hidden="true" /><span>Profile</span>
              </button>
              <button type="button" role="tab" aria-selected={section === "security"} className={section === "security" ? "active" : ""} onClick={() => selectSection("security")}>
                <LockKeyhole size={18} aria-hidden="true" /><span>Security</span>
              </button>
              {!isStaff && <button type="button" role="tab" aria-selected={section === "archives"} className={section === "archives" ? "active" : ""} onClick={() => selectSection("archives")}>
                <Archive size={18} aria-hidden="true" /><span>Archives</span>
              </button>}
            </nav>

            <div className="account-settings-security-note">
              <KeyRound size={18} aria-hidden="true" />
              <div><strong>Account protection</strong><p>Use a unique password and keep your sign-in details private.</p></div>
            </div>
          </aside>

          <section className="account-settings-panel" role="tabpanel">
            {section === "account" ? (
              <form className="account-settings-form" onFocusCapture={() => setAccountFormFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountFormFocused(false); }} onSubmit={saveProfile} aria-busy={savingProfile}>
                <div className="account-panel-heading">
                  <div className="account-panel-heading-main"><UserRound size={20} aria-hidden="true" /><div><h3>Personal information</h3><p>Update the information associated with your portal account.</p></div></div>
                </div>
                {profileError && <div className="account-settings-feedback error" role="alert">{profileError}</div>}
                {profileSuccess && <div className="account-settings-feedback success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{profileSuccess}</div>}

                <div className="account-photo-row">
                  <div className="account-photo-current">
                    {previewImage ? <img src={previewImage} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <Camera size={21} aria-hidden="true" />}
                  </div>
                  <div className="account-photo-copy"><strong>Profile photo</strong><p id="account-profile-photo-help">JPG, PNG, or WEBP. Maximum file size: 2 MB.</p>{photo && <span className="account-photo-selected">{photo.name}</span>}</div>
                  <label className="account-photo-button"><Camera size={16} aria-hidden="true" /><span>Choose photo</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} disabled={savingProfile} aria-invalid={Boolean(getProfileFieldError("profile_picture"))} aria-describedby={getProfileFieldError("profile_picture") ? "account-field-error-profile_picture" : "account-profile-photo-help"} /></label>
                </div>
                {renderProfileFieldError("profile_picture")}

                <div className="account-form-grid">
                  {isStaff ? (
                    <>
                      <label className="account-field"><span>First name <strong className="account-required-mark" aria-hidden="true">*</strong></span><input name="first_name" value={form.first_name} onChange={updateProfileField} autoComplete="given-name" maxLength={100} required {...profileFieldAccessibility("first_name")} />{renderProfileFieldError("first_name")}</label>
                      <label className="account-field"><span>Middle name</span><input name="middle_name" value={form.middle_name} onChange={updateProfileField} autoComplete="additional-name" maxLength={100} {...profileFieldAccessibility("middle_name")} />{renderProfileFieldError("middle_name")}</label>
                      <label className="account-field"><span>Last name <strong className="account-required-mark" aria-hidden="true">*</strong></span><input name="last_name" value={form.last_name} onChange={updateProfileField} autoComplete="family-name" maxLength={100} required {...profileFieldAccessibility("last_name")} />{renderProfileFieldError("last_name")}</label>
                      <label className="account-field"><span>Suffix <small>Optional</small></span><input name="suffix" value={form.suffix} onChange={updateProfileField} maxLength={30} placeholder="Jr., Sr., III" {...profileFieldAccessibility("suffix")} />{renderProfileFieldError("suffix")}</label>
                      <label className="account-field"><span>Date of birth</span><input type="date" name="date_of_birth" value={form.date_of_birth} onChange={updateProfileField} max={new Date().toISOString().slice(0, 10)} {...profileFieldAccessibility("date_of_birth")} />{renderProfileFieldError("date_of_birth")}</label>
                    </>
                  ) : (
                    <label className="account-field"><span>Full name <strong className="account-required-mark" aria-hidden="true">*</strong></span><input name="name" value={form.name} onChange={updateProfileField} autoComplete="name" maxLength={255} required {...profileFieldAccessibility("name")} />{renderProfileFieldError("name")}</label>
                  )}
                  <label className="account-field"><span><Phone size={15} aria-hidden="true" />Contact number</span><input name="contact_number" type="tel" value={form.contact_number} onChange={updateProfileField} autoComplete="tel" maxLength={30} {...profileFieldAccessibility("contact_number")} />{renderProfileFieldError("contact_number")}</label>
                  <label className="account-field account-field-readonly account-field-wide"><span><Mail size={15} aria-hidden="true" />Email address</span><input type="email" value={user.email || ""} readOnly aria-readonly="true" /><small>Email changes require a verified account-change flow.</small></label>
                  <label className="account-field account-field-readonly"><span>Role</span><input value={roleLabel} readOnly aria-readonly="true" /></label>
                  <label className="account-field account-field-readonly"><span>Status</span><input value={statusLabel} readOnly aria-readonly="true" /></label>
                </div>

                <section className="account-preferences" aria-labelledby="account-preferences-title">
                  <div className="account-preferences-heading">
                    <Bell size={18} aria-hidden="true" />
                    <div><h4 id="account-preferences-title">Account preferences</h4><p>Manage your notification and communication preferences.</p></div>
                  </div>
                  <div className="account-preferences-grid">
                    <label className="account-preference-item">
                      <Mail size={19} aria-hidden="true" />
                      <span className="account-preference-copy"><strong>Email notifications</strong><small>Receive marketplace activity updates by email.</small></span>
                      <span className="account-preference-switch">
                        <input type="checkbox" role="switch" name="email_notifications_enabled" checked={form.email_notifications_enabled} onChange={updateProfileField} disabled={savingProfile || loading} />
                        <span aria-hidden="true" />
                      </span>
                    </label>
                    <label className="account-preference-item">
                      <Bell size={19} aria-hidden="true" />
                      <span className="account-preference-copy"><strong>In-app notifications</strong><small>Get notified about activities in the portal.</small></span>
                      <span className="account-preference-switch">
                        <input type="checkbox" role="switch" name="in_app_notifications_enabled" checked={form.in_app_notifications_enabled} onChange={updateProfileField} disabled={savingProfile || loading} />
                        <span aria-hidden="true" />
                      </span>
                    </label>
                  </div>
                </section>

                {isStaff && (
                  <section className="account-readonly-section">
                    <div className="account-readonly-heading"><BriefcaseBusiness size={18} aria-hidden="true" /><div><h4>Staff employment details</h4><p>These details are managed by the TMC Administrator.</p></div></div>
                    <div className="account-readonly-grid">
                      <div><span>Employee ID</span><strong>{staff.employee_id || "Not assigned"}</strong></div>
                      <div><span>Department</span><strong>{staff.department || "Not assigned"}</strong></div>
                      <div><span>Position</span><strong>{staff.position || "Not assigned"}</strong></div>
                      <div><span>Employment status</span><strong>{staff.employment_status || "Not assigned"}</strong></div>
                      <div><span>Start date</span><strong>{staff.employment_start_date || "Not assigned"}</strong></div>
                      <div><span>Campus</span><strong>{staff.campus || "Not assigned"}</strong></div>
                    </div>
                  </section>
                )}

                <div className="account-form-footer">
                  <p><ShieldCheck size={15} aria-hidden="true" />Only your personal details and notification preferences can be changed here.</p>
                  <div className="account-form-actions">
                    <button className="account-secondary-button" type="button" onClick={cancelProfileChanges} disabled={savingProfile || loading}>Cancel</button>
                    <button className="account-primary-button" type="submit" disabled={savingProfile || loading}><Save size={16} aria-hidden="true" />{savingProfile ? "Saving…" : "Save changes"}</button>
                  </div>
                </div>
              </form>
            ) : section === "security" ? (
              <form className="account-settings-form account-password-form" onFocusCapture={() => setAccountFormFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setAccountFormFocused(false); }} onSubmit={savePassword}>
                <div className="account-panel-heading">
                  <div><span className="account-settings-eyebrow">LOGIN SECURITY</span><h3>Change password</h3><p>Confirm your current password before choosing a new one.</p></div>
                  <div className="account-panel-icon"><LockKeyhole size={20} aria-hidden="true" /></div>
                </div>
                {passwordError && <div className="account-settings-feedback error" role="alert">{passwordError}</div>}
                {passwordSuccess && <div className="account-settings-feedback success" role="status"><CheckCircle2 size={17} aria-hidden="true" />{passwordSuccess}</div>}
                <div className="account-password-fields">
                  {[
                    { name: "current_password", label: "Current password", autocomplete: "current-password" },
                    { name: "password", label: "New password", autocomplete: "new-password" },
                    { name: "password_confirmation", label: "Confirm new password", autocomplete: "new-password" },
                  ].map((field) => (
                    <label className="account-field account-password-field" key={field.name}>
                      <span>{field.label}</span>
                      <input type={showPasswords ? "text" : "password"} name={field.name} value={passwords[field.name]} onChange={updatePasswordField} autoComplete={field.autocomplete} minLength={field.name === "current_password" ? undefined : 8} required />
                    </label>
                  ))}
                  <button type="button" className="account-password-visibility" onClick={() => setShowPasswords((visible) => !visible)} aria-label={showPasswords ? "Hide passwords" : "Show passwords"}>
                    {showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}{showPasswords ? "Hide passwords" : "Show passwords"}
                  </button>
                </div>
                <div className="account-password-guidance"><ShieldCheck size={18} aria-hidden="true" /><p>Choose at least 8 characters. Your new password must match the confirmation field.</p></div>
                <div className="account-form-footer"><p><LockKeyhole size={15} aria-hidden="true" />Your password is stored securely.</p><button className="account-primary-button" type="submit" disabled={savingPassword}><KeyRound size={16} aria-hidden="true" />{savingPassword ? "Updating…" : "Update password"}</button></div>
              </form>
            ) : !isStaff ? (
              <div className="account-archives-panel">
                <div className="account-panel-heading">
                  <div><span className="account-settings-eyebrow">RETAINED RECORDS</span><h3>Archive management</h3><p>Review archived listings and Staff accounts while keeping their order and audit history intact.</p></div>
                </div>
                {archivesError && <div className="account-settings-feedback error" role="alert">{archivesError}</div>}
                {archivesLoading && <div className="account-settings-notice" role="status">Loading archived records…</div>}
                <section className="account-archive-group" aria-labelledby="archived-products-heading">
                  <div className="account-archive-group-heading"><h4 id="archived-products-heading"><Package size={17} aria-hidden="true" />Archived products</h4><span>{archivedProducts.length}</span></div>
                  {archivedProducts.length ? <div className="account-archive-list">{archivedProducts.map((product) => <article className="account-archive-item" key={`product-${product.id}`}><div className="account-archive-item-icon"><Package size={17} aria-hidden="true" /></div><div className="account-archive-item-copy"><strong>{product.name || "Unnamed product"}</strong><span>{product.category || "Uncategorized"} · Seller: {product.user?.name || "Unknown"}</span><small>Archived {archiveDate(product.archived_at)}</small></div><button type="button" className="account-archive-restore" disabled={restoringProductId === product.id} onClick={() => handleRestoreProduct(product.id)}>{restoringProductId === product.id ? "Restoring." : "Restore for review"}</button></article>)}</div> : !archivesLoading && <p className="account-archive-empty">No archived products found.</p>}
                </section>
                <section className="account-archive-group" aria-labelledby="archived-staff-heading">
                  <div className="account-archive-group-heading"><h4 id="archived-staff-heading"><UsersRound size={17} aria-hidden="true" />Archived Staff accounts</h4><span>{archivedStaff.length}</span></div>
                  {archivedStaff.length ? <div className="account-archive-list">{archivedStaff.map((member) => <article className="account-archive-item" key={`staff-${member.id}`}><div className="account-archive-item-icon"><UsersRound size={17} aria-hidden="true" /></div><div className="account-archive-item-copy"><strong>{member.name || "Staff account"}</strong><span>{member.profile?.department || "Department not assigned"} · {member.email || "Email unavailable"}</span><small>Archived {archiveDate(member.profile?.archived_at)}</small></div><span className="account-archive-status">Archived</span></article>)}</div> : !archivesLoading && <p className="account-archive-empty">No archived Staff accounts found.</p>}
                </section>
                <p className="account-archive-note"><ShieldCheck size={16} aria-hidden="true" />Archived products can be restored for moderation review only; they do not become marketplace-active automatically. Staff archive remains read-only.</p>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </AdminLayout>
  );
}
