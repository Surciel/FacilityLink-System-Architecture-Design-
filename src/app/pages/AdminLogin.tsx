import { useState } from "react";
import { useNavigate } from "react-router";
import { Lock, User, LogIn, PackageOpen } from "lucide-react";
import { toast } from "sonner";

export function AdminLogin() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  // Preset credentials from environment variables
  const ADMIN_USERNAME = (import.meta as any).env.VITE_ADMIN_USERNAME || "";
  const ADMIN_PASSWORD = (import.meta as any).env.VITE_ADMIN_PASSWORD || "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (
      formData.username === ADMIN_USERNAME &&
      formData.password === ADMIN_PASSWORD
    ) {
      toast.success("Login successful!");
      navigate("/admin");
    } else {
      toast.error("Invalid username or password");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#A8C5DA] via-[#5891B8] to-[#2E6B95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>

      <div className="relative w-full max-w-md">
        {/* Back to Home */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6 transition-colors"
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
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    placeholder="Enter username"
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
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-[#5891B8] to-[#3776A0] text-white py-3 rounded-lg hover:from-[#4A89B0] hover:to-[#2E6B95] transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <LogIn className="w-5 h-5" />
                Sign In
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
