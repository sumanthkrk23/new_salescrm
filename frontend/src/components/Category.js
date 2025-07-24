import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Edit, Trash2, Save, X } from "lucide-react";

const Category = () => {
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");
  const tableWrapperRef = useRef(null);
  const [showScrollRight, setShowScrollRight] = useState(false);
  const [showScrollLeft, setShowScrollLeft] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/category");
      setCategories(res.data.categories || []);
    } catch (err) {
      setError("Failed to fetch categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess("");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    const checkScroll = () => {
      if (tableWrapperRef.current) {
        const el = tableWrapperRef.current;
        setShowScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
        setShowScrollLeft(el.scrollLeft > 0);
      }
    };
    checkScroll();
    window.addEventListener("resize", checkScroll);
    if (tableWrapperRef.current) {
      tableWrapperRef.current.addEventListener("scroll", checkScroll);
    }
    return () => {
      window.removeEventListener("resize", checkScroll);
      if (tableWrapperRef.current) {
        tableWrapperRef.current.removeEventListener("scroll", checkScroll);
      }
    };
  }, [categories]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!category.trim()) {
      setError("Category is required");
      return;
    }
    try {
      await axios.post("/api/category", { category });
      setCategory("");
      setSuccess("Category added successfully!");
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add category");
    }
  };

  const handleEdit = (cat) => {
    setEditingCategory(cat.id);
    setEditValue(cat.category);
    // Convert the date string to YYYY-MM-DD format for the date input
    const dateObj = new Date(cat.created_date);
    const formattedDate = dateObj.toISOString().split('T')[0];
    setEditDate(formattedDate);
  };

  const handleUpdate = async (categoryId) => {
    setError("");
    if (!editValue.trim()) {
      setError("Category is required");
      return;
    }
    if (!editDate) {
      setError("Date is required");
      return;
    }
    try {
      await axios.put(`/api/category/${categoryId}`, {
        category: editValue,
        created_date: editDate
      });
      setEditingCategory(null);
      setEditValue("");
      setEditDate("");
      setSuccess("Category updated successfully!");
      fetchCategories();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update category");
    }
  };

  const handleDelete = async (categoryId) => {
    if (window.confirm("Are you sure you want to delete this category?")) {
      try {
        await axios.delete(`/api/category/${categoryId}`);
        setSuccess("Category deleted successfully!");
        fetchCategories();
      } catch (err) {
        setError(err.response?.data?.error || "Failed to delete category");
      }
    }
  };

  const cancelEdit = () => {
    setEditingCategory(null);
    setEditValue("");
    setEditDate("");
  };

  return (
    <div className="bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Category Management</h1>
              <p className="mt-1 text-sm text-gray-600">Manage and organize your categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Category Form */}
        <div className="bg-white rounded-lg shadow-sm border mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Add New Category</h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category Name
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter category name"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200"
              >
                Add Category
              </button>
            </form>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-800">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Categories Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">All Categories</h2>
          </div>
          <div className="overflow-x-auto relative pb-8" ref={tableWrapperRef}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/*
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
*/}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((cat, index) => (
                  <tr key={cat.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {/*
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{cat.id}
                        </td>
*/}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingCategory === cat.id ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          onKeyPress={(e) => {
                            if (e.key === "Enter") {
                              handleUpdate(cat.id);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-sm text-gray-900 font-medium">{cat.category}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingCategory === cat.id ? (
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">{cat.created_date}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {editingCategory === cat.id ? (
                        <div className="flex space-x-2">
                          <div className="relative group">
                            <button
                              onClick={() => handleUpdate(cat.id)}
                              className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-md transition-colors duration-200"
                            >
                              <Save size={18} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              Save
                            </div>
                          </div>
                          <div className="relative group">
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors duration-200"
                            >
                              <X size={18} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              Close
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex space-x-2">
                          <div className="relative group">
                            <button
                              onClick={() => handleEdit(cat)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors duration-200"
                            >
                              <Edit size={18} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              Edit
                            </div>
                          </div>
                          <div className="relative group">
                            <button
                              onClick={() => handleDelete(cat.id)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-md transition-colors duration-200"
                            >
                              <Trash2 size={18} />
                            </button>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                              Delete
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {showScrollRight && (
              <div className="sticky float-right right-0 bottom-2 z-20 text-xs text-gray-700 bg-white bg-opacity-90 px-3 py-1 rounded shadow-lg pointer-events-none" style={{ whiteSpace: 'nowrap' }}>
                Scroll →
              </div>
            )}
            {showScrollLeft && !showScrollRight && (
              <div className="sticky float-left left-0 bottom-2 z-20 text-xs text-gray-700 bg-white bg-opacity-90 px-3 py-1 rounded shadow-lg pointer-events-none" style={{ whiteSpace: 'nowrap' }}>
                ← Scroll
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Category;
