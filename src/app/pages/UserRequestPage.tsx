import { useState, useEffect, useRef } from "react";
import {
  PackageOpen,
  Send,
  User,
  Lock,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { supabase } from "../../supabaseClient";

interface RequestItem {
  id: string;
  itemDescription: string;
  unitOfMeasure: string;
  quantity: number;
  suggestions?: string[];
  showSuggestions?: boolean;
  suggestionsFor?: "id" | "description"; // Track which field has suggestions
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
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup debounce timers on component unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimersRef.current).forEach((timer) =>
        clearTimeout(timer),
      );
    };
  }, []);

  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>({
    fullName: "",
    userType: "",
    studentNumber: "",
    facultyId: "+63 ",
    college: "",
    department: "",
  });

  const [items, setItems] = useState<RequestItem[]>([
    {
      id: "",
      itemDescription: "",
      unitOfMeasure: "",
      quantity: 1,
      suggestions: [],
      showSuggestions: false,
      suggestionsFor: undefined,
    },
  ]);

  // State for available inventory items
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<{
    type: "id" | "description";
    index: number;
  } | null>(null);

  const [dropdownPortal, setDropdownPortal] = useState<{
    type: "id" | "description";
    index: number;
    left: number;
    top: number;
    width: number;
  } | null>(null);

  // Update dropdown position on scroll
  useEffect(() => {
    if (!activeDropdown || !dropdownPortal) return;

    const handleScroll = () => {
      const buttons = document.querySelectorAll(
        `[data-dropdown-button="${activeDropdown.type}-${activeDropdown.index}"]`,
      );
      if (buttons.length === 0) return;

      const button = buttons[0] as HTMLElement;
      const rect = button.getBoundingClientRect();

      setDropdownPortal((prev) =>
        prev
          ? {
              ...prev,
              left: rect.left,
              top: rect.bottom + 8,
            }
          : null,
      );
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [activeDropdown, dropdownPortal]);

  const handleDropdownButtonClick = (
    type: "id" | "description",
    index: number,
    event: any,
  ) => {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    if (activeDropdown?.type === type && activeDropdown.index === index) {
      setActiveDropdown(null);
      setDropdownPortal(null);
      return;
    }

    setActiveDropdown({ type, index });
    setDropdownPortal({
      type,
      index,
      left: rect.left,
      top: rect.bottom + 8,
      width: Math.max(rect.width, 320),
    });
  };

  // Fetch available inventory items on component mount
  useEffect(() => {
    if (personalInfo.userType) {
      fetchAvailableItems();
    }
  }, [personalInfo.userType]);

  const fetchAvailableItems = async () => {
    if (!personalInfo.userType) return;

    setLoadingItems(true);
    try {
      const facilityPrefix =
        personalInfo.userType === "faculty" ? "JMS" : "GYM-S";

      const { data, error } = await supabase
        .from("inventory")
        .select("item_no, description, unit, remaining_stock")
        .ilike("item_no", `${facilityPrefix}%`)
        .order("item_no", { ascending: true });

      if (error) {
        console.error("Error fetching inventory:", error);
        return;
      }

      setAvailableItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: "",
        itemDescription: "",
        unitOfMeasure: "",
        quantity: 1,
        suggestions: [],
        showSuggestions: false,
        suggestionsFor: undefined,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, idx) => idx !== index));
    }
  };

  const lookupInventoryItem = async (
    searchValue: string,
    searchBy: "id" | "description",
  ) => {
    if (!searchValue.trim()) return null;

    // Determine the facility prefix based on user type
    const facilityPrefix =
      personalInfo.userType === "faculty" ? "JMS" : "GYM-S";

    // If searching by ID, search with the full ID (prefix + separator + number)
    const separator = personalInfo.userType === "faculty" ? "" : "-";
    const searchTerm =
      searchBy === "id"
        ? `${facilityPrefix}${separator}${searchValue}`
        : searchValue;

    const { data, error } = await supabase
      .from("inventory")
      .select("item_no, description, unit")
      .ilike(searchBy === "id" ? "item_no" : "description", `%${searchTerm}%`)
      .ilike("item_no", `${facilityPrefix}%`) // Filter by facility prefix
      .limit(10);

    if (error || !data) return null;
    return data;
  };

  const handleItemChange = (
    itemIndex: number,
    field: keyof RequestItem,
    value: string | number,
  ) => {
    // If clearing id or itemDescription completely, clear all related fields
    if ((field === "id" || field === "itemDescription") && value === "") {
      setItems((prevItems) =>
        prevItems.map((item, idx) =>
          idx === itemIndex
            ? {
                ...item,
                id: "",
                itemDescription: "",
                unitOfMeasure: "",
                quantity: 1,
                suggestions: [],
                showSuggestions: false,
                suggestionsFor: undefined,
              }
            : item,
        ),
      );
      return;
    }

    // Check if id or itemDescription was modified after a selection (digit/word removed/changed)
    let shouldClearRelatedFields = false;
    if (
      field === "itemDescription" &&
      typeof value === "string" &&
      value.trim() !== ""
    ) {
      const currentItem = items[itemIndex];
      // If there was a description before and it's different now, clear related fields
      if (
        currentItem.itemDescription &&
        currentItem.itemDescription !== value &&
        currentItem.id
      ) {
        shouldClearRelatedFields = true;
      }
    }
    if (field === "id" && typeof value === "string" && value.trim() !== "") {
      const currentItem = items[itemIndex];
      // If there was an id before and it's different now, clear related fields
      if (
        currentItem.id &&
        currentItem.id !== value &&
        currentItem.itemDescription
      ) {
        shouldClearRelatedFields = true;
      }
    }

    // Update the field value
    let updatedItems = items.map((item, idx) => {
      if (idx === itemIndex) {
        let updatedItem = { ...item, [field]: value };
        // If id or description was modified, also clear related fields
        if (
          shouldClearRelatedFields &&
          (field === "itemDescription" || field === "id")
        ) {
          updatedItem = {
            ...updatedItem,
            id: field === "id" ? (value as string) : "",
            itemDescription:
              field === "itemDescription" ? (value as string) : "",
            unitOfMeasure: "",
            quantity: 1,
          };
        }
        return updatedItem;
      }
      return item;
    });
    setItems(updatedItems);

    // Only debounce lookup for id and itemDescription
    if (
      (field === "id" || field === "itemDescription") &&
      typeof value === "string"
    ) {
      const timerKey = `${itemIndex}-${field}`;

      // Clear previous timer for this field
      if (debounceTimersRef.current[timerKey]) {
        clearTimeout(debounceTimersRef.current[timerKey]);
      }

      // Set new debounced timer (300ms delay)
      debounceTimersRef.current[timerKey] = setTimeout(() => {
        (async () => {
          if (value.trim()) {
            const results = await lookupInventoryItem(
              field === "id" ? value.replace(/^(JMS|GYM-S)(-)?/, "") : value,
              field === "id" ? "id" : "description",
            );

            setItems((prevItems) =>
              prevItems.map((item, idx) =>
                idx === itemIndex
                  ? {
                      ...item,
                      suggestions: results
                        ? results.map((r) =>
                            field === "id" ? r.item_no : r.description,
                          )
                        : [],
                      showSuggestions: !!(results && results.length > 0),
                      suggestionsFor: field === "id" ? "id" : "description",
                    }
                  : item,
              ),
            );
          } else {
            // Clear suggestions if field is empty
            setItems((prevItems) =>
              prevItems.map((item, idx) =>
                idx === itemIndex
                  ? {
                      ...item,
                      suggestions: [],
                      showSuggestions: false,
                      suggestionsFor: undefined,
                    }
                  : item,
              ),
            );
          }
        })();
      }, 300); // 300ms debounce delay
    }
  };

  const selectSuggestion = async (
    itemIndex: number,
    suggestion: string,
    searchBy: "id" | "description",
  ) => {
    // Build the query based on which field was searched
    let query = supabase
      .from("inventory")
      .select("item_no, description, unit, remaining_stock");

    if (searchBy === "id") {
      query = query.eq("item_no", suggestion);
    } else {
      query = query.eq("description", suggestion);
    }

    // Ensure facility filtering
    const facilityPrefix =
      personalInfo.userType === "faculty" ? "JMS" : "GYM-S";
    query = query.ilike("item_no", `${facilityPrefix}%`);

    const { data, error } = await query.single();

    if (error || !data) return;

    if (data.remaining_stock <= 0) {
      toast.error("Selected item is currently unavailable (out of stock).");
      return;
    }

    setItems(
      items.map((item, idx) =>
        idx === itemIndex
          ? {
              ...item,
              id: data.item_no,
              itemDescription: data.description,
              unitOfMeasure: data.unit,
              suggestions: [],
              showSuggestions: false,
              suggestionsFor: undefined,
            }
          : item,
      ),
    );
  };

  const selectFromDropdown = (itemIndex: number, selectedItemNo: string) => {
    const selectedItem = availableItems.find(
      (item) => item.item_no === selectedItemNo,
    );
    if (!selectedItem) return;

    if (selectedItem.remaining_stock <= 0) {
      toast.error(
        "Selected item is currently unavailable (out of stock). Please choose another item.",
      );
      return;
    }

    console.log("Selected item:", selectedItem);

    setItems(
      items.map((item, idx) =>
        idx === itemIndex
          ? {
              ...item,
              id: selectedItem.item_no,
              itemDescription: selectedItem.description,
              unitOfMeasure: selectedItem.unit,
              quantity: 1,
              suggestions: [],
              showSuggestions: false,
              suggestionsFor: undefined,
            }
          : item,
      ),
    );

    setActiveDropdown(null);
  };

  const validateStep1 = () => {
    if (!personalInfo.fullName || !personalInfo.userType) {
      toast.error("Please fill in all required fields");
      return false;
    }
    if (
      personalInfo.userType === "student" &&
      (!personalInfo.studentNumber || !personalInfo.college)
    ) {
      toast.error("Please enter your student number and college");
      return false;
    }
    if (personalInfo.userType === "faculty" && !personalInfo.department) {
      toast.error("Please enter your department");
      return false;
    }
    if (
      personalInfo.userType === "faculty" &&
      !/^\+63 \d{3} \d{3} \d{4}$/.test(personalInfo.facultyId)
    ) {
      toast.error("Phone number must be in format +63 XXX XXX XXXX");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const hasEmptyItems = items.some(
      (item) =>
        !item.id ||
        !item.itemDescription ||
        !item.unitOfMeasure ||
        item.quantity < 1,
    );
    if (hasEmptyItems) {
      toast.error("Please fill in all item details and select a quantity");
      return false;
    }
    return true;
  };

  const handleSubmitToSupabase = async () => {
    setSubmitting(true);

    try {
      const department =
        personalInfo.userType === "faculty"
          ? personalInfo.department
          : personalInfo.college;

      const facilityPrefix =
        personalInfo.userType === "faculty" ? "JMS" : "GYM-S";

      // Step 1: Validate all items exist and have sufficient stock
      const validatedItems = [];
      for (const item of items) {
        const { data: inventoryItem, error: fetchError } = await supabase
          .from("inventory")
          .select("item_no, description, unit, remaining_stock")
          .eq("item_no", item.id)
          .ilike("item_no", `${facilityPrefix}%`)
          .single();

        if (fetchError || !inventoryItem) {
          toast.error(
            `Item ID "${item.id}" not found or not available for your account type.`,
          );
          setSubmitting(false);
          return;
        }

        if (item.quantity > inventoryItem.remaining_stock) {
          toast.error(
            `Not enough stock for "${inventoryItem.description}". Only ${inventoryItem.remaining_stock} ${inventoryItem.unit}(s) available.`,
          );
          setSubmitting(false);
          return;
        }

        validatedItems.push({
          ...item,
          inventoryDescription: inventoryItem.description,
          inventoryUnit: inventoryItem.unit,
          currentStock: inventoryItem.remaining_stock,
        });
      }

      // Step 2: Generate a request group ID to link all items from this submission
      const requestGroupId = crypto.randomUUID();

      // Get current time in Philippine Time (UTC+8)
      const phTime = new Date(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      );

      // Step 3: Insert each item as a separate row in requests table
      const requestsToInsert = validatedItems.map((item) => ({
        item_no: item.id,
        description: item.inventoryDescription,
        unit: item.inventoryUnit,
        quantity_requested: item.quantity,
        requested_by: personalInfo.fullName,
        department: department,
        request_group_id: requestGroupId,
        created_at: phTime.toISOString(),
      }));

      const { error: requestsInsertError } = await supabase
        .from("requests")
        .insert(requestsToInsert);

      if (requestsInsertError) {
        toast.error("Failed to submit request. Please try again.");
        console.error(requestsInsertError);
        setSubmitting(false);
        return;
      }

      // Step 4: Update inventory stock for all items
      for (const item of validatedItems) {
        const { error: stockError } = await supabase
          .from("inventory")
          .update({
            remaining_stock: item.currentStock - item.quantity,
          })
          .eq("item_no", item.id);

        if (stockError) {
          toast.error(
            `Failed to update stock for: ${item.inventoryDescription}`,
          );
          console.error(stockError);
          setSubmitting(false);
          return;
        }
      }

      toast.success("Request submitted successfully!");
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
    if (currentStep > 1) {
      // Clear items when going back from step 2 to step 1
      if (currentStep === 2) {
        setItems([
          {
            id: "",
            itemDescription: "",
            unitOfMeasure: "",
            quantity: 1,
            suggestions: [],
            showSuggestions: false,
            suggestionsFor: undefined,
          },
        ]);
        // Clear personal info as well
        setPersonalInfo({
          fullName: "",
          userType: "",
          studentNumber: "",
          facultyId: "+63 ",
          college: "",
          department: "",
        });
      }
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartNewRequest = () => {
    setCurrentStep(1);
    setPersonalInfo({
      fullName: "",
      userType: "",
      studentNumber: "",
      facultyId: "+63 ",
      college: "",
      department: "",
    });
    setItems([
      {
        id: "",
        itemDescription: "",
        unitOfMeasure: "",
        quantity: 1,
        suggestions: [],
        showSuggestions: false,
        suggestionsFor: undefined,
      },
    ]);
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
              <h1 className="text-3xl font-bold text-white">
                Requisition and Issue System
              </h1>
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
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                      currentStep >= step
                        ? "bg-[#4A89B0] text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {step}
                  </div>
                  <span
                    className={`font-medium ${currentStep >= step ? "text-gray-900" : "text-gray-500"}`}
                  >
                    {step === 1
                      ? "Personal Info"
                      : step === 2
                        ? "Request Materials"
                        : "Confirmation"}
                  </span>
                </div>
                {index < 2 && (
                  <div className="flex-1 h-1 mx-4 bg-gray-200">
                    <div
                      className={`h-full transition-all ${currentStep > step ? "bg-[#4A89B0] w-full" : "w-0"}`}
                    />
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Personal Information
                </h2>
                <p className="text-gray-600">
                  Please provide your details to continue
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={personalInfo.fullName}
                      onChange={(e) => {
                        const filtered = e.target.value.replace(
                          /[^a-zA-Z\s]/g,
                          "",
                        );
                        setPersonalInfo({
                          ...personalInfo,
                          fullName: filtered,
                        });
                      }}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      placeholder="Enter your full name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    I am a *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setPersonalInfo({
                          ...personalInfo,
                          userType: "student",
                          facultyId: "",
                        })
                      }
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
                      onClick={() =>
                        setPersonalInfo({
                          ...personalInfo,
                          userType: "faculty",
                          studentNumber: "",
                          facultyId: "+63 ",
                        })
                      }
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Student Number *
                    </label>
                    <input
                      type="text"
                      value={personalInfo.studentNumber}
                      onChange={(e) => {
                        let value = e.target.value.replace(/[^0-9]/g, "");

                        // Add dash after 4 digits
                        if (value.length > 4) {
                          value = value.slice(0, 4) + "-" + value.slice(4);
                        }
                        
                        setPersonalInfo({
                          ...personalInfo,
                          studentNumber: value,
                        });
                      }}
                      maxLength={10}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      placeholder="XXXX-XXXXX"
                    />
                  </div>
                )}

                {personalInfo.userType === "faculty" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="text"
                      value={personalInfo.facultyId}
                      onChange={(e) => {
                        // Extract only digits from the entire input
                        const allDigits = e.target.value.replace(/\D/g, "");
                        
                        // Remove the leading 63 if present (user shouldn't be able to change it)
                        let userDigits = allDigits.startsWith("63") 
                          ? allDigits.slice(2) 
                          : allDigits;
                        
                        // Enforce max length of 10 digits
                        if (userDigits.length > 10) {
                          userDigits = userDigits.slice(0, 10);
                        }
                        
                        // Format as +63 XXX XXX XXXX
                        let formatted = "+63";
                        if (userDigits.length > 0) {
                          formatted += " " + userDigits.slice(0, 3);
                          if (userDigits.length > 3) {
                            formatted += " " + userDigits.slice(3, 6);
                          }
                          if (userDigits.length > 6) {
                            formatted += " " + userDigits.slice(6, 10);
                          }
                        } else {
                          formatted += " ";
                        }
                        
                        setPersonalInfo({
                          ...personalInfo,
                          facultyId: formatted,
                        });
                      }}
                      maxLength={17}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                      placeholder="+63 XXX XXX XXXX"
                    />
                  </div>
                )}

                {personalInfo.userType === "student" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      College *
                    </label>
                    <select
                      value={personalInfo.college}
                      onChange={(e) =>
                        setPersonalInfo({
                          ...personalInfo,
                          college: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    >
                      <option value="" disabled hidden>
                        Select college
                      </option>
                      <option value="College of Engineering">
                        College of Engineering
                      </option>
                      <option value="College of Science">
                        College of Science
                      </option>
                      <option value="College of Humanities and Social Science">
                        College of Humanities and Social Science
                      </option>
                      <option value="College of Business Administration">
                        College of Business Administration
                      </option>
                      <option value="College of Education">
                        College of Education
                      </option>
                      <option value="College of Nursing">
                        College of Nursing
                      </option>
                      <option value="College of Information Systems and Technology Management">
                        College of Information Systems and Technology Management
                      </option>
                    </select>
                  </div>
                )}

                {personalInfo.userType === "faculty" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department *
                    </label>
                    <select
                      value={personalInfo.department}
                      onChange={(e) =>
                        setPersonalInfo({
                          ...personalInfo,
                          department: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#4A89B0] focus:border-transparent"
                    >
                      <option value="" disabled hidden>
                        Select department
                      </option>
                      <option value="IT Department">IT Department</option>
                      <option value="HR Department">HR Department</option>
                      <option value="Finance Department">
                        Finance Department
                      </option>
                      <option value="Operations Department">
                        Operations Department
                      </option>
                      <option value="Marketing Department">
                        Marketing Department
                      </option>
                      <option value="Academic Affairs">Academic Affairs</option>
                      <option value="Administration">Administration</option>
                      <option value="Library Services">Library Services</option>
                      <option value="Student Affairs">Student Affairs</option>
                      <option value="Research and Development">
                        Research and Development
                      </option>
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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Request Materials
                </h2>
                <p className="text-gray-600">
                  Add the items you need. You can either select from the
                  dropdown or manually enter item details.
                </p>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-3 px-4 font-bold text-gray-900">
                        #
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[140px]">
                        Item No.
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[280px]">
                        Item Description
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[100px]">
                        Unit of Mea.
                      </th>
                      <th className="text-left py-3 px-4 font-bold text-gray-900 min-w-[80px]">
                        Quantity
                      </th>
                      <th className="py-3 px-4 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-200">
                        <td className="py-3 px-4 text-gray-700">{index + 1}</td>
                        <td className="py-3 px-4">
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              <div className="relative flex gap-0">
                                <div className="w-20 bg-gray-200 border border-green-300 rounded-l flex items-center justify-center font-medium text-gray-700 text-sm">
                                  {personalInfo.userType === "faculty"
                                    ? "JMS"
                                    : "GYM-S"}
                                </div>
                                <input
                                  type="text"
                                  value={item.id.replace(
                                    /^(JMS|GYM-S)(-)?/,
                                    "",
                                  )}
                                  onChange={(e) => {
                                    const facilityPrefix =
                                      personalInfo.userType === "faculty"
                                        ? "JMS"
                                        : "GYM-S";
                                    const numericOnly = e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 3);
                                    const separator =
                                      personalInfo.userType === "faculty"
                                        ? ""
                                        : "-";
                                    handleItemChange(
                                      index,
                                      "id",
                                      facilityPrefix + separator + numericOnly,
                                    );
                                  }}
                                  maxLength={3}
                                  className="w-16 px-2 py-2 bg-green-100 border border-green-300 rounded-r focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm"
                                  placeholder="000"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleDropdownButtonClick("id", index, e)
                                }
                                data-dropdown-button={`id-${index}`}
                                className="h-9 w-9 rounded border border-blue-300 bg-white text-blue-600 hover:bg-blue-100 hover:scale-110 transition-all flex items-center justify-center"
                                aria-label="Open item ID picker"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>

                            {activeDropdown?.type === "id" &&
                              activeDropdown.index === index &&
                              dropdownPortal?.type === "id" &&
                              dropdownPortal.index === index && (
                                <div
                                  className="z-50 rounded border border-gray-200 bg-white shadow-lg"
                                  style={{
                                    position: "fixed",
                                    left: `${dropdownPortal.left}px`,
                                    top: `${dropdownPortal.top}px`,
                                    minWidth: `${dropdownPortal.width}px`,
                                    maxHeight: 240,
                                    overflowY: "auto",
                                  }}
                                >
                                  {availableItems.map((invItem) => (
                                    <button
                                      key={invItem.item_no}
                                      type="button"
                                      onClick={() =>
                                        selectFromDropdown(
                                          index,
                                          invItem.item_no,
                                        )
                                      }
                                      disabled={invItem.remaining_stock <= 0}
                                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                        invItem.remaining_stock <= 0
                                          ? "text-gray-400 line-through cursor-not-allowed"
                                          : "text-gray-900 hover:bg-blue-50 cursor-pointer"
                                      }`}
                                    >
                                      {invItem.item_no} - {invItem.description}
                                      {invItem.remaining_stock <= 0
                                        ? " (Out of stock)"
                                        : ""}
                                    </button>
                                  ))}
                                </div>
                              )}

                            {item.showSuggestions &&
                              item.suggestionsFor === "id" &&
                              item.suggestions &&
                              item.suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10">
                                  {item.suggestions.map((suggestion, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() =>
                                        selectSuggestion(
                                          index,
                                          suggestion,
                                          "id",
                                        )
                                      }
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-100 border-b border-gray-200 last:border-b-0"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                          </div>
                        </td>
                        <td className="py-3 px-4 relative">
                          <div className="relative">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={item.itemDescription}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "itemDescription",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-3 py-2 bg-green-100 border border-green-300 rounded focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                                placeholder="Enter item description"
                              />
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleDropdownButtonClick(
                                    "description",
                                    index,
                                    e,
                                  )
                                }
                                data-dropdown-button={`description-${index}`}
                                className="h-9 w-9 rounded border border-blue-300 bg-white text-blue-600 hover:bg-blue-50 flex items-center justify-center"
                                aria-label="Open item description picker"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>

                            {activeDropdown?.type === "description" &&
                              activeDropdown.index === index &&
                              dropdownPortal?.type === "description" &&
                              dropdownPortal.index === index && (
                                <div
                                  className="z-50 rounded border border-gray-200 bg-white shadow-lg"
                                  style={{
                                    position: "fixed",
                                    left: `${dropdownPortal.left}px`,
                                    top: `${dropdownPortal.top}px`,
                                    minWidth: `${Math.max(dropdownPortal.width, 380)}px`,
                                    maxHeight: 240,
                                    overflowY: "auto",
                                  }}
                                >
                                  {availableItems.map((invItem) => (
                                    <button
                                      key={invItem.item_no}
                                      type="button"
                                      onClick={() =>
                                        selectFromDropdown(
                                          index,
                                          invItem.item_no,
                                        )
                                      }
                                      disabled={invItem.remaining_stock <= 0}
                                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                        invItem.remaining_stock <= 0
                                          ? "text-gray-400 line-through cursor-not-allowed"
                                          : "text-gray-900 hover:bg-blue-50 cursor-pointer"
                                      }`}
                                    >
                                      {invItem.description} ({invItem.item_no})
                                      {invItem.remaining_stock <= 0
                                        ? " (Out of stock)"
                                        : ""}
                                    </button>
                                  ))}
                                </div>
                              )}

                            {item.showSuggestions &&
                              item.suggestionsFor === "description" &&
                              item.suggestions &&
                              item.suggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10">
                                  {item.suggestions.map((suggestion, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() =>
                                        selectSuggestion(
                                          index,
                                          suggestion,
                                          "description",
                                        )
                                      }
                                      className="w-full text-left px-3 py-2 text-sm hover:bg-blue-100 border-b border-gray-200 last:border-b-0"
                                    >
                                      {suggestion}
                                    </button>
                                  ))}
                                </div>
                              )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={item.unitOfMeasure}
                            readOnly
                            className="w-full px-3 py-2 bg-gray-200 border border-gray-400 rounded cursor-not-allowed text-gray-700"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            value={
                              item.id && item.itemDescription
                                ? item.quantity === 0
                                  ? ""
                                  : item.quantity
                                : ""
                            }
                            onChange={(e) => {
                              const value = e.target.value;
                              const numValue = parseInt(value) || 0;
                              handleItemChange(index, "quantity", numValue);
                            }}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              if (value < 1) {
                                handleItemChange(index, "quantity", 1);
                              }
                            }}
                            disabled={!item.id || !item.itemDescription}
                            className={`w-full px-3 py-2 rounded focus:ring-2 focus:ring-indigo-600 focus:border-transparent ${
                              item.id && item.itemDescription
                                ? "bg-green-100 border border-green-300 cursor-default"
                                : "bg-gray-200 border border-gray-400 cursor-not-allowed text-gray-500"
                            }`}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(index)}
                              className="text-gray-400 hover:text-red-600 hover:scale-125 transition-all p-1"
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
                  className="bg-black text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-800 hover:scale-110 hover:shadow-xl transition-all shadow-lg"
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
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Request Sent Successfully!
                </h2>
                <p className="text-lg text-gray-600">
                  Your inventory request has been submitted and is now pending
                  admin review.
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
