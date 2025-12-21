// CategoryPopup.js

import { useState } from "react";
import { CategoryIcon } from "../../utils/categoryIcons";
import { ChevronRight, Tag, Plus, Settings, Trash2, X, FolderOpen } from "lucide-react";

export default function CategoryPopup({ categories, formData, selectCategory, deleteCategory, setShowAddCategoryModal }) {
  const [showPopup, setShowPopup] = useState(false);
  const [isManaging, setIsManaging] = useState(false); 

  // Filter categories to only show the ones matching the current type (income/expense)
  const filteredCategories = categories.filter(cat => cat.type === formData.type);
  const selectedCategory = categories.find(cat => cat._id === formData.category);

  // ฟังก์ชันสลับโหมดจัดการ
  const toggleManaging = (e) => {
    e.stopPropagation();
    setIsManaging(prev => !prev);
  }

  return (
    <div>
      {/* Input-like category selector */}
      <div>
        <button
          type="button"
          onClick={() => setShowPopup(true)}
          className="w-full px-3 py-3 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50 hover:border-[#299D91] transition-all duration-200 shadow-sm flex items-center justify-between group"
        >
          <div className="flex items-center gap-3">
            <div className="p-1 bg-gray-100 rounded group-hover:bg-[#299D91]/10 transition-colors">
              <CategoryIcon iconName={selectedCategory?.icon || 'Folder'} size={24} className="text-gray-600" />
            </div>
            <span className={`font-semibold text-base ${selectedCategory ? 'text-gray-800' : 'text-gray-500'}`}>
              {selectedCategory?.name || 'เลือกหมวดหมู่'}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#299D91] transition-colors" />
        </button>
      </div>



      {/* Category Selection Popup/Modal */}
      {showPopup && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-black/50 z-50 p-4" style={{ fontFamily: 'Noto Sans Thai, sans-serif' }}>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-4xl p-6 h-[70vh] flex flex-col transform transition-all duration-300 scale-95 md:scale-100 border border-white/20">
            
            {/* Header Area */}
            <div className="flex justify-between items-center mb-4 border-b border-gray-200 pb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-gradient-to-br from-[#299D91] to-[#238A80] rounded-xl shadow-lg">
                    <Tag className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      เลือกหมวดหมู่
                    </h2>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {formData.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                    {/* ปุ่ม เพิ่มใหม่ */}
                    <button
                        type="button"
                        onClick={() => {
                            setShowPopup(false);
                            setShowAddCategoryModal(true);
                        }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 flex items-center text-xs font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                        <Plus className="w-3 h-3 mr-1" />
                        เพิ่มใหม่
                    </button>
                    {/* ปุ่ม จัดการหมวดหมู่ */}
                    <button
                        type="button"
                        onClick={toggleManaging}
                        className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center text-xs font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 ${
                            isManaging 
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700' 
                              : 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700 hover:from-gray-300 hover:to-gray-400'
                        }`}
                    >
                        <Settings className="w-3 h-3 mr-1" />
                        {isManaging ? 'ยกเลิก' : 'จัดการ'}
                    </button>
                </div>
            </div>
            {/* End Header Area */}

            {/* Grid for Categories (Scrollable) */}
            <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 overflow-y-auto pb-4 flex-grow">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat) => (
                  <div
                    key={cat._id}
                    className={`
                        bg-white/80 backdrop-blur-sm border-2 rounded-xl p-3 flex-shrink-0 transition-all duration-300 shadow-lg hover:shadow-xl
                        flex flex-col items-center justify-between space-y-2 cursor-pointer h-28 group
                        ${isManaging ? 'border-dashed border-2 border-orange-300 hover:bg-red-50/50 hover:border-red-300' : ''}
                        ${
                            formData.category === cat._id && !isManaging 
                            ? "border-[#299D91] bg-gradient-to-br from-[#299D91]/10 to-[#238A80]/10 ring-2 ring-[#299D91]/30 transform scale-105 shadow-xl" 
                            : "border-gray-200 hover:border-[#299D91] hover:bg-gradient-to-br hover:from-[#299D91]/5 hover:to-[#238A80]/5"
                        }
                    `}
                    onClick={() => {
                        if (!isManaging) { // อนุญาตให้เลือกหมวดหมู่ได้เมื่อไม่อยู่ในโหมดจัดการ
                            selectCategory(cat._id);
                            setShowPopup(false);
                        }
                    }}
                  >
                    <div className="w-full text-center text-gray-800 font-medium flex flex-col items-center flex-grow justify-center">
                      <div className={`p-2 rounded-xl mb-2 transition-all duration-200 ${
                        formData.category === cat._id && !isManaging 
                          ? 'bg-gradient-to-br from-[#299D91] to-[#238A80] shadow-lg' 
                          : 'bg-gray-100 group-hover:bg-[#299D91]/10'
                      }`}>
                        <CategoryIcon 
                          iconName={cat.icon} 
                          size={24} 
                          className={formData.category === cat._id && !isManaging ? 'text-white' : 'text-gray-600 group-hover:text-[#299D91]'} 
                        />
                      </div>
                      <span className={`text-xs font-bold truncate ${
                        formData.category === cat._id && !isManaging ? 'text-[#299D91]' : 'text-gray-700 group-hover:text-[#299D91]'
                      }`}>{cat.name}</span>
                    </div>

                    {/* ปุ่มลบ จะแสดงเมื่ออยู่ในโหมดจัดการเท่านั้น */}
                    {isManaging && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent selection/modal from closing
                            deleteCategory(cat._id);
                          }}
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white p-1.5 rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 text-xs font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <div className="flex items-center justify-center space-x-1">
                            <Trash2 className="w-3 h-3" />
                            <span>ลบ</span>
                          </div>
                        </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-8 text-center mt-4 p-8 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50/50">
                  <div className="p-3 bg-gray-100 rounded-xl inline-block mb-3">
                    <FolderOpen className="w-8 h-8 text-gray-400" strokeWidth={1} />
                  </div>
                  <p className="text-gray-500 text-sm font-medium mb-1">ไม่พบหมวดหมู่สำหรับประเภทนี้</p>
                  <p className="text-gray-400 text-xs">โปรดคลิก <span className="font-semibold text-blue-600">"เพิ่มใหม่"</span> เพื่อสร้างหมวดหมู่ใหม่</p>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="mt-4 flex justify-end border-t border-gray-200 pt-4">
              <button
                onClick={() => {
                    setShowPopup(false);
                    setIsManaging(false); // ออกจากโหมดจัดการเมื่อปิด
                }}
                className="px-6 py-2 bg-gradient-to-r from-gray-200 to-gray-300 rounded-lg hover:from-gray-300 hover:to-gray-400 transition-all duration-200 font-semibold text-gray-800 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <div className="flex items-center space-x-2">
                  <X className="w-4 h-4" />
                  <span>{isManaging ? 'เสร็จสิ้น' : 'ปิด'}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
