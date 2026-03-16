import { useState } from "react";
import { PackageOpen, Send, User, Lock, ChevronRight, ChevronLeft, Check, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";

interface RequestItem {
  id: string;
  itemDescription: string;
  unitOfMeasure: string;
  quantity: number;
}

interface PersonalInfo {
  fullName: string;
  userType: "student" | "faculty" | "";
  studentNumber: string;
  facultyId: string;
  college: string;
  department: string;
}

export function UserRequestPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    fullName: "",
    userType: "",
    studentNumber: "",
    facultyId: "",
    college: "",
    department: "",
  });

  const [items, setItems] = useState<RequestItem[]>([
    { id: "1", itemDescription: "", unitOfMeasure: "", quantity: 1 },
  ]);

  const units = [
    "Piece/s", "Box/es", "Ream/s", "Pack/s", "Set/s",
    "Bottle/s", "Roll/s", "Sheet/s", "Dozen", "Kilogram", "Liter", "Meter",
  ];

  const handleAddItem = () => {
    const newId = (items.length + 1).toString();
    setItems([...items, { id: newId, itemDescription: "", unitOfMeasure: "", quantity: 1 }]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: keyof RequestItem, value: string | number) => {
    setItems(items.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const validateStep1 = () => {
    if (!personalInfo.fullName || !personalInfo.userType) {
      toast.error("Please fill in all required fields");
      return false;
    }
    if (personalInfo.userType === "student" && (!personalInfo.studentNumber || !personalInfo.college)) {
      toast.error("Please enter your student number and college");
      return false;
    }
    if (personalInfo.userType === "faculty" && (!personalInfo.facultyId || !personalInfo.department)) {
      toast.error("Please enter your faculty ID and department");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const hasEmptyItems = items.some(
      (item) => !item.itemDescription || !item.unitOfMeasure || item.quantity < 1
    );
    if (hasEmptyItems) {
      toast.error("Please fill in all item details");
      return false;
    }
    return true;
  };

  const handleSubmitToSupabase = async () => {
  setSubmitting(true);

  try {
    const department = personalInfo.userType === "faculty"
      ? personalInfo.department
      : personalInfo.college;

    for (const item of items) {
      // 1. Fetch by item_no instead of description
      const { data: inventoryItem, error: fetchError } = await supabase
        .from("inventory")
        .select("item_no, description, unit, remaining_stock")
        .eq("item_no", item.id)  // ← uses the ID field the user typed
        .single();

      if (fetchError || !inventoryItem) {
        toast.error(`Item ID "${item.id}" was not found in inventory`);
        setSubmitting(false);
        return;
      }

      // 2. Cross-check quantity against remaining stock
      if (item.quantity > inventoryItem.remaining_stock) {
        toast.error(
          `Not enough stock for "${inventoryItem.description}". Only ${inventoryItem.remaining_stock} ${inventoryItem.unit}(s) available.`
        );
        setSubmitting(false);
        return;
      }

      // 3. Insert request
      const { error: insertError } = await supabase
        .from("requests")
        .insert({
          item_no: inventoryItem.item_no,
          description: inventoryItem.description,  // auto-filled from inventory
          unit: inventoryItem.unit,                 // auto-filled from inventory
          quantity_requested: item.quantity,
          requested_by: personalInfo.fullName,
          department: department,
          status: "pending",
        });

      if (insertError) {
        toast.error(`Failed to submit request for: ${inventoryItem.description}`);
        console.error(insertError);
        setSubmitting(false);
        return;
      }
    }

    setCurrentStep(3);

  } catch (error) {
    toast.error("Something went wrong. Please try again.");
    console.error(error);
  } finally {
    setSubmitting(false);
  }
};

  const handleNextStep = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && validateStep2()) {
      handleSubmitToSupabase();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleStartNewRequest = () => {
    setCurrentStep(1);
    setPersonalInfo({
      fullName: "",
      userType: "",
      studentNumber: "",
      facultyId: "",
      college: "",
      department: "",
    });
    setItems([{ id: "1", itemDescription: "", unitOfMeasure: "", quantity: 1 }]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Access Button */}
      <button
        onClick={() => navigate("/admin/login")}
        className="fixed bottom-4 right-4 bg-gray-800 hover:bg-gray-900 text-white p-4 rounded-full shadow-lg transition-all hover:scale-110 z-50 group"
        title="Admin Login"
      >
        <Lock className="w-6 h-6" />
        <span className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-xs px-3 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
          Admin Login
        </span>
      </button>

      {/* Header */}
      <header className="bg-[#4A89B0] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-white p-3 rounded-lg">
              <PackageOpen className="w-8 h-8 text-[#4A89B0]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Requisition and Issue System</h1>
              <p className="text-white/80">Submit your material requests</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((step, index) => (
              <>
                <div key={step} className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                    currentStep >= step ? "bg-[#4A89B0] text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {step}
                  </div>
                  <span className={`font-medium ${currentStep >= step ? "text-gray-900" : "text-gray-500"}`}>
                    {step === 1 ? "Personal Info" : step === 2 ? "Request Materials" : "Confirmation"}
                  </span>
                </div>
                {index < 2 && (
                  <div className="flex-1 h-1 mx-4 bg-gray-200">
                    <div className={`h-full transition-all ${currentStep > step ? "bg-[#4A89B0] w-full" : "w-0"}`} />
                  </div>
                )}
              </>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">

          {/* Step 1: Personal Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Personal Information</h2>
                <p className="text-gray-600">Please provide your details to continue</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={personalInfo.fullName}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, fullName: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">I am a *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setPersonalInfo({ ...personalInfo, userType: "student", facultyId: "" })}
                      className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                        personalInfo.userType === "student"
                          ? "border-[#4A89B0] bg-blue-50 text-[#4A89B0]"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      Student
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonalInfo({ ...personalInfo, userType: "faculty", studentNumber: "" })}
                      className={`py-3 px-4 rounded-lg border-2 font-medium transition-all ${
                        personalInfo.userType === "faculty"
                          ? "border-[#4A89B0] bg-blue-50 text-[#4A89B0]"
                          : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      Faculty
                    </button>
                  </div>
                </div>

                {personalInfo.userType === "student" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Student Number *</label>
                    <input
                      type="text"
                      value={personalInfo.studentNumber}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, studentNumber: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      placeholder="Enter your student number"
                    />
                  </div>
                )}

                {personalInfo.userType === "faculty" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Faculty ID *</label>
                    <input
                      type="text"
                      value={personalInfo.facultyId}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, facultyId: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      placeholder="Enter your faculty ID"
                    />
                  </div>
                )}

                {personalInfo.userType === "student" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">College *</label>
                    <select
                      value={personalInfo.college}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, college: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    >
                      <option value="">Select college</option>
                      <option value="College of Engineering">College of Engineering</option>
                      <option value="College of Science">College of Science</option>
                      <option value="College of Humanities and Social Science">College of Humanities and Social Science</option>
                      <option value="College of Business Administration">College of Business Administration</option>
                      <option value="College of Education">College of Education</option>
                      <option value="College of Nursing">College of Nursing</option>
                      <option value="College of Information Systems and Technology Management">College of Information Systems and Technology Management</option>
                    </select>
                  </div>
                )}

                {personalInfo.userType === "faculty" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Department *</label>
                    <select
                      value={personalInfo.department}
                      onChange={(e) => setPersonalInfo({ ...personalInfo, department: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    >
                      <option value="">Select department</option>
                      <option value="IT Department">IT Department</option>
                      <option value="HR Department">HR Department</option>
                      <option value="Finance Department">Finance Department</option>
                      <option value="Operations Department">Operations Department</option>
                      <option value="Marketing Department">Marketing Department</option>
                      <option value="Academic Affairs">Academic Affairs</option>
                      <option value="Administration">Administration</option>
                      <option value="Library Services">Library Services</option>
                      <option value="Student Affairs">Student Affairs</option>
                      <option value="Research and Development">Research and Development</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-[#4A89B0] text-white px-6 py-3 rounded-lg hover:bg-[#3776A0] transition-colors flex items-center gap-2"
                >
                  Next: Request Materials
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Request Materials */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Materials</h2>
                <p className="text-gray-600">Add the items you need. Item descriptions must match inventory exactly.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-3 px-4 font-bold text-gray-900">#</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[100px]">ID</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[250px]">Item Description</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[150px]">Unit of Mea.</th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[120px]">Quantity</th>
                      <th className="py-3 px-4 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="py-3 px-4 text-gray-700">{index + 1}</td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.id}
                            onChange={(e) => handleItemChange(item.id, "id", e.target.value)}
                            className="w-full px-3 py-2 bg-green-100 border border-green-300 rounded focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            placeholder="ID"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.itemDescription}
                            onChange={(e) => handleItemChange(item.id, "itemDescription", e.target.value)}
                            className="w-full px-3 py-2 bg-green-100 border border-green-300 rounded focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            placeholder="Enter item description"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={item.unitOfMeasure}
                            onChange={(e) => handleItemChange(item.id, "unitOfMeasure", e.target.value)}
                            className="w-full px-3 py-2 bg-green-100 border border-green-300 rounded focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                          >
                            <option value="">Select unit</option>
                            {units.map((unit) => (
                              <option key={unit} value={unit}>{unit}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, "quantity", parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 bg-green-100 border border-green-300 rounded focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                            min="1"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-gray-400 hover:text-red-600 transition-colors p-1"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="bg-black text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-800 transition-colors shadow-lg"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  disabled={submitting}
                  className="border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:border-gray-400 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={submitting}
                  className="bg-[#4A89B0] text-white px-6 py-3 rounded-lg hover:bg-[#3776A0] transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {currentStep === 3 && (
            <div className="text-center space-y-6 py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-green-100 rounded-full">
                <Check className="w-12 h-12 text-green-600" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Request Sent Successfully!</h2>
                <p className="text-lg text-gray-600">
                  Your inventory request has been submitted and is now pending admin review.
                </p>
              </div>
              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleStartNewRequest}
                  className="bg-[#4A89B0] text-white px-8 py-3 rounded-lg hover:bg-[#3776A0] transition-colors"
                >
                  Submit Another Request
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}