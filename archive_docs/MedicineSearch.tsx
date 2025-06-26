import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { ApiClient } from '@/lib/apiClient';
import { Medicine } from '@/types/medicine';

interface MedicineSearchProps {
  onSelectMedicine: (medicine: Medicine) => void;
  maxDropdownHeight?: number; // 可以自定义下拉菜单高度
}

// 暴露给父组件的方法
export interface MedicineSearchRef {
  focusInput: () => void;
}

const MedicineSearch = forwardRef<MedicineSearchRef, MedicineSearchProps>(({ 
  onSelectMedicine,
  maxDropdownHeight = 300 // 默认高度
}, ref) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Medicine[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // 暴露聚焦方法给父组件
  useImperativeHandle(ref, () => ({
    focusInput: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }));
  
  // 自动聚焦到搜索框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 创建异步搜索函数
  const searchMedicines = async (term: string): Promise<Medicine[]> => {
    const apiClient = new ApiClient();
    try {
      console.log('【药品搜索调试】开始搜索:', term);
      console.log('【药品搜索调试】当前环境:', apiClient.getCurrentEnvironment());
      console.log('【药品搜索调试】API基础URL:', apiClient.client?.defaults?.baseURL);
      
      // 记录搜索参数 - 尝试后端建议的路径和参数格式
      const searchParams = { search: term, limit: 15 };
      console.log('【药品搜索调试】搜索参数:', searchParams);
      
      // 尝试直接使用后端路径，不带/api/v1前缀
      console.log('【药品搜索调试】尝试调用直接路径: /medicines');
      const response = await apiClient.get('/medicines', searchParams);
      
      // 记录API响应
      console.log('【药品搜索调试】API响应完整结构:', JSON.stringify(response, null, 2));
      console.log('【药品搜索调试】响应类型:', Array.isArray(response) ? '数组' : typeof response);
      console.log('【药品搜索调试】响应长度:', Array.isArray(response) ? response.length : '非数组');
      
      // 尝试处理可能的不同响应格式
      let results: Medicine[] = [];
      
      if (Array.isArray(response)) {
        console.log('【药品搜索调试】使用数组响应格式');
        results = response;
      } else if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          console.log('【药品搜索调试】使用response.data数组格式');
          results = response.data;
        } else if (response.medicines && Array.isArray(response.medicines)) {
          console.log('【药品搜索调试】使用response.medicines数组格式');
          results = response.medicines;
        }
      }
      
      console.log('【药品搜索调试】最终结果数量:', results.length);
      if (results.length > 0) {
        console.log('【药品搜索调试】第一个结果示例:', results[0]);
      } else {
        console.log('【药品搜索调试】没有找到结果');
      }
      
      // ApiClient已经处理了 {success: true, data: [...]} 格式，直接返回的就是数据数组
      return results;
    } catch (err) {
      console.error('【药品搜索调试】搜索失败:', err);
      if (err instanceof Error) {
        console.error('【药品搜索调试】错误详情:', err.message);
        console.error('【药品搜索调试】错误堆栈:', err.stack);
      }
      throw new Error('搜索服务暂时不可用，请稍后重试');
    }
  };

  // 搜索药品
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setResults([]);
      setIsDropdownVisible(false);
      setError(null);
      return;
    }

    let cancelled = false;
    
    const performSearch = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const searchResults = await searchMedicines(searchTerm);
        if (!cancelled) {
          setResults(searchResults);
          setIsDropdownVisible(searchResults.length > 0);
          setSelectedIndex(0);
        }
      } catch (err) {
        if (!cancelled) {
          const errorMsg = err instanceof Error ? err.message : '搜索失败，请重试';
          setError(errorMsg);
          setResults([]);
          setIsDropdownVisible(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    performSearch();

    return () => {
      cancelled = true;
    };
  }, [searchTerm]);

  // 键盘导航
  useHotkeys('down', (e) => {
    e.preventDefault();
    if (results.length > 0) {
      const newIndex = (selectedIndex + 1) % results.length;
      setSelectedIndex(newIndex);
      
      // 自动滚动到选中的项
      ensureItemVisible(newIndex);
    }
  }, { enableOnFormTags: true, enabled: isDropdownVisible });
  
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (results.length > 0) {
      const newIndex = (selectedIndex - 1 + results.length) % results.length;
      setSelectedIndex(newIndex);
      
      // 自动滚动到选中的项
      ensureItemVisible(newIndex);
    }
  }, { enableOnFormTags: true, enabled: isDropdownVisible });
  
  useHotkeys('enter', (e) => {
    if (isDropdownVisible && results.length > 0) {
      e.preventDefault();
      handleSelectMedicine(results[selectedIndex]);
    }
  }, { enableOnFormTags: true, enabled: isDropdownVisible });

  // 确保选中的项在视野内
  const ensureItemVisible = (index: number) => {
    if (dropdownRef.current) {
      const dropdown = dropdownRef.current;
      const items = dropdown.querySelectorAll('li');
      if (items[index]) {
        const item = items[index];
        const dropdownTop = dropdown.scrollTop;
        const dropdownBottom = dropdownTop + dropdown.clientHeight;
        const itemTop = item.offsetTop;
        const itemBottom = itemTop + item.clientHeight;

        if (itemTop < dropdownTop) {
          dropdown.scrollTop = itemTop;
        } else if (itemBottom > dropdownBottom) {
          dropdown.scrollTop = itemBottom - dropdown.clientHeight;
        }
      }
    }
  };

  // 处理选择药品
  const handleSelectMedicine = (medicine: Medicine) => {
    onSelectMedicine(medicine);
    setSearchTerm('');
    setResults([]);
    setIsDropdownVisible(false);
  };

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) && 
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsDropdownVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-300 rounded-md overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
        <input
          ref={inputRef}
          type="text"
          className="w-full px-4 py-2 outline-none"
          placeholder="搜索药材..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            if (searchTerm.trim() !== '' && results.length > 0) {
              setIsDropdownVisible(true);
            }
          }}
        />
        {/* 加载状态或清除按钮 */}
        {isLoading ? (
          <div className="p-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : searchTerm && (
          <button
            className="p-2 text-gray-500 hover:text-gray-700"
            onClick={() => {
              setSearchTerm('');
              setResults([]);
              setIsDropdownVisible(false);
              setError(null);
              inputRef.current?.focus();
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </button>
        )}
      </div>

      {/* 错误显示 */}
      {error && (
        <div className="absolute z-50 w-full mt-1 bg-red-50 border border-red-200 rounded-md shadow-lg">
          <div className="px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        </div>
      )}

      {/* 搜索结果下拉菜单 */}
      {isDropdownVisible && !error && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg overflow-y-auto" 
          style={{ maxHeight: `${maxDropdownHeight}px` }}
        >
          <ul className="divide-y divide-gray-100">
            {results.map((medicine, index) => (
              <li
                key={medicine.id}
                className={`px-4 py-3 cursor-pointer transition-colors duration-150 ${
                  index === selectedIndex ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleSelectMedicine(medicine)}
              >
                <div className="font-medium text-gray-900">{medicine.chineseName}</div>
                <div className="text-sm text-gray-500 mt-1">{medicine.englishName} ({medicine.pinyinName})</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

MedicineSearch.displayName = 'MedicineSearch';

export default MedicineSearch; 