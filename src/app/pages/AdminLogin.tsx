import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock, User, LogIn, PackageOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient"; // Ensure this matches your project client path

export function AdminLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Authenticate with Supabase using email/password
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        {
          email: formData.email,
          password: formData.password,
        },
      );

      if (authError || !data.user) {
        console.error("Authentication error:", authError?.message);
        toast.error("Invalid email or password");
        setLoading(false);
        return;
      }

      // 2. Verify admin role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("access_role")
        .eq("user_id", data.user.id)
        .eq("access_role", "admin")
        .maybeSingle();

      if (profileError) {
        console.error("Profile fetch error:", profileError.message);
        // Sign out if profile check fails
        await supabase.auth.signOut();
        toast.error("Failed to verify admin role");
        setLoading(false);
        return;
      }

      if (!profile) {
        // Sign out if user is not admin
        await supabase.auth.signOut();
        toast.error("You do not have admin access");
        setLoading(false);
        return;
      }

      // 3. Store admin role in localStorage for client-side checks
      localStorage.setItem("facility_link_role", profile.access_role);
      localStorage.setItem("facility_link_user", data.user.email || "");

      // Success sequence
      toast.success("Login successful!");
      navigate("/admin");
    } catch (err: any) {
      console.error("Critical authentication exception:", err.message);
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#A8C5DA] via-[#5891B8] to-[#2E6B95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>

      <div className="relative w-full max-w-md">
        {/* Back to Home */}
        <button
          onClick={() => navigate("/")}
          disabled={loading}
          className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors disabled:opacity-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Home
        </button>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#5891B8] to-[#3776A0] p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-xl">
                <PackageOpen className="w-12 h-12" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center">Admin Portal</h2>
            <p className="text-white/80 text-center mt-2">
              FacilityLink: Centralized Inventory System
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    disabled={loading}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent disabled:opacity-60"
                    placeholder="Enter admin email"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    disabled={loading}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent disabled:opacity-60"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#5891B8] to-[#3776A0] text-white py-3 rounded-lg hover:from-[#4A89B0] hover:to-[#2E6B95] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <LogIn className="w-5 h-5" />
                {loading ? "Signing In..." : "Sign In"}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-sm mt-6">
          For security purposes, access is restricted to authorized personnel
          only
        </p>
      </div>
    </div>
  );
}
