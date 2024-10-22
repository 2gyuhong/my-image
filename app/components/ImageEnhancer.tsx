import React, { useState, useEffect, useRef, WheelEvent } from 'react';

interface ImageFile {
  file: File;
  preview: string;
  enhanced?: string;
  isSelected: boolean;
  width: number;
  height: number;
  processingTime?: number;
  enhancedWidth?: number;
  enhancedHeight?: number;
  scale: number;
  position: { x: number; y: number };
}

const ImageEnhancer: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageSizes, setImageSizes] = useState<{[key: number]: {width: number, height: number}}>({});
  const imageRefs = useRef<{[key: number]: HTMLImageElement}>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const draggedImageIndex = useRef<number | null>(null);
  const [enhancingProgress, setEnhancingProgress] = useState<{[key: number]: number}>({});

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // 이전에 선택한 파일들의 URL 해제
      selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
      
      const newFiles: ImageFile[] = [];
      
      Array.from(event.target.files).forEach(file => {
        const img = new Image();
        img.onload = () => {
          newFiles.push({
            file,
            preview: URL.createObjectURL(file),
            isSelected: true,
            width: img.width,
            height: img.height,
            scale: 1,
            position: { x: 0, y: 0 } // 초기 위치 추가
          });
          
          if (newFiles.length === event.target.files!.length) {
            setSelectedFiles(newFiles);
          }
        };
        img.src = URL.createObjectURL(file);
      });
    }
  };

  const handleCheckboxChange = (index: number) => {
    setSelectedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { ...file, isSelected: !file.isSelected } : file
      )
    );
  };

  const handleZoom = (index: number, zoomIn: boolean) => {
    setSelectedFiles(prev => 
      prev.map((file, i) => {
        if (i === index) {
          const newScale = zoomIn ? file.scale * 1.2 : file.scale / 1.2;
          return { ...file, scale: Math.max(0.1, Math.min(5, newScale)) };
        }
        return file;
      })
    );
  };

  const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxWidth = 1024; // 최대 너비 설정
          const maxHeight = 1024; // 최대 높이 설정
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 품질 설정 (0.7 = 70%)
          resolve(compressedDataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleEnhanceImage = async () => {
    const filesToProcess = selectedFiles.filter(file => file.isSelected && !file.enhanced);
    if (filesToProcess.length === 0) return;

    setIsLoading(true);
    setError(null);

    const updatedFiles = [...selectedFiles];

    for (let [index, file] of filesToProcess.entries()) {
      const fileIndex = selectedFiles.indexOf(file);
      const startTime = Date.now();
      try {
        setEnhancingProgress(prev => ({ ...prev, [fileIndex]: 0 }));
        const compressedImage = await compressImage(file.file);
        const response = await fetch('/api/enhance-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: compressedImage.split(',')[1] }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        if (result.taskId) {
          const enhancedImageUrl = await checkEnhancementStatus(result.taskId, fileIndex);
          const endTime = Date.now();
          
          const enhancedImg = new Image();
          enhancedImg.onload = () => {
            updatedFiles[fileIndex].enhanced = enhancedImageUrl;
            updatedFiles[fileIndex].processingTime = endTime - startTime;
            updatedFiles[fileIndex].enhancedWidth = enhancedImg.width;
            updatedFiles[fileIndex].enhancedHeight = enhancedImg.height;
            setSelectedFiles([...updatedFiles]);
          };
          enhancedImg.src = enhancedImageUrl;
        } else {
          throw new Error('작업 ID를 받지 못했습니다.');
        }
      } catch (error) {
        console.error('API 호출 오류:', error);
        setError(`API 호출 오류: ${error}`);
      }
      setEnhancingProgress(prev => ({ ...prev, [fileIndex]: 100 }));
    }

    setIsLoading(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const formatProcessingTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };

  const checkEnhancementStatus = async (taskId: string, fileIndex: number): Promise<string> => {
    while (true) {
      const response = await fetch(`/api/check-enhancement-status?taskId=${taskId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      if (result.status === 'success') {
        return result.image;
      } else if (result.status === 'error') {
        throw new Error(result.message);
      } else {
        setEnhancingProgress(prev => ({ ...prev, [fileIndex]: (prev[fileIndex] || 0) + 10 }));
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  const calculateImageRatio = (index: number) => {
    const img = imageRefs.current[index];
    const originalSize = imageSizes[index];
    if (img && originalSize) {
      const widthRatio = (img.width / originalSize.width * 100).toFixed(2);
      const heightRatio = (img.height / originalSize.height * 100).toFixed(2);
      return `${widthRatio}% x ${heightRatio}%`;
    }
    return null;
  };

  const handleMouseDown = (event: React.MouseEvent, index: number) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
    draggedImageIndex.current = index;
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (isDragging && draggedImageIndex.current !== null) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      setSelectedFiles(prev => 
        prev.map((file, i) => 
          i === draggedImageIndex.current
            ? { ...file, position: { x: file.position.x + dx, y: file.position.y + dy } }
            : file
        )
      );
      setDragStart({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    draggedImageIndex.current = null;
  };

  const handleReset = (index: number) => {
    setSelectedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { ...file, scale: 1, position: { x: 0, y: 0 } } : file
      )
    );
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    const delta = event.deltaY;
    const zoomSpeed = 0.1;
    
    setSelectedFiles(prev => 
      prev.map((file, i) => {
        if (i === index) {
          const newScale = delta > 0 
            ? Math.max(0.1, file.scale - zoomSpeed)
            : Math.min(5, file.scale + zoomSpeed);
          return { ...file, scale: newScale };
        }
        return file;
      })
    );
  };

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const index = Number(entry.target.getAttribute('data-index'));
        setImageSizes(prev => ({
          ...prev,
          [index]: { width: entry.contentRect.width, height: entry.contentRect.height }
        }));
      });
    });

    Object.entries(imageRefs.current).forEach(([index, img]) => {
      observer.observe(img);
    });

    return () => {
      observer.disconnect();
    };
  }, [selectedFiles]);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove as any);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove as any);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="container mx-auto px-4">
      <h2 className="text-2xl font-bold mb-4">이미지 화질 개선하기</h2>
      <div className="mb-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          multiple
          className="mb-2 p-2 border rounded w-full"
        />
        {selectedFiles.length > 0 && (
          <div className="text-sm text-gray-600">
            선택된 파일: {selectedFiles.map(file => file.file.name).join(', ')}
          </div>
        )}
      </div>
      {selectedFiles.length > 0 && (
        <button
          onClick={handleEnhanceImage}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4"
          disabled={isLoading}
        >
          {isLoading ? '처리 중...' : '화질 개선하기'}
        </button>
      )}
      {error && <p className="text-red-500 mt-2 mb-4">{error}</p>}
      <div className="space-y-8">
        {selectedFiles.map((file, index) => (
          <div key={index} className="flex flex-col md:flex-row gap-4 items-start border p-4 rounded">
            <div className="w-full md:w-1/2">
              <h3 className="text-xl font-bold mb-2">
                원본 이미지: {file.width} x {file.height} 픽셀
              </h3>
              <img src={file.preview} alt={`Selected ${index}`} className="max-w-full h-auto" />
            </div>
            <div className="w-full md:w-1/2">
              <h3 className="text-xl font-bold mb-2">
                개선된 이미지:
                {file.processingTime && ` (처리 시간: ${formatProcessingTime(file.processingTime)})`}
                {file.enhancedWidth && file.enhancedHeight && ` ${file.enhancedWidth} x ${file.enhancedHeight} 픽셀`}
                {calculateImageRatio(index) && ` (현재 크기: ${calculateImageRatio(index)})`}
              </h3>
              {file.isSelected && (
                <div>
                  <div className="mb-2">
                    <button
                      onClick={() => handleZoom(index, true)}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded mr-2"
                    >
                      확대 (+)
                    </button>
                    <button
                      onClick={() => handleZoom(index, false)}
                      className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded mr-2"
                    >
                      축소 (-)
                    </button>
                    <button
                      onClick={() => handleReset(index)}
                      className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-2 rounded mr-2"
                    >
                      초기화
                    </button>
                    <span className="ml-2">현재 배율: {(file.scale * 100).toFixed(0)}%</span>
                  </div>
                  {file.enhanced ? (
                    <div 
                      className="relative" 
                      style={{ width: '100%', paddingTop: '100%', overflow: 'hidden' }}
                      onMouseDown={(e) => handleMouseDown(e, index)}
                      onWheel={(e) => handleWheel(e, index)}
                    >
                      <img 
                        ref={el => { if (el) imageRefs.current[index] = el; }}
                        src={file.enhanced} 
                        alt={`Enhanced ${index}`} 
                        className="absolute top-0 left-0 w-full h-full object-contain cursor-move" 
                        data-index={index}
                        style={{ 
                          transform: `scale(${file.scale}) translate(${file.position.x}px, ${file.position.y}px)`,
                          transformOrigin: 'center',
                          transition: 'none'
                        }}
                      />
                    </div>
                  ) : (
                    <div className="relative" style={{ width: '100px', height: '100px' }}>
                      <svg className="circular-progress" viewBox="0 0 100 100">
                        <circle
                          className="circular-progress-path"
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          strokeWidth="10"
                          stroke="#f3f3f3"
                        />
                        <circle
                          className="circular-progress-path"
                          cx="50"
                          cy="50"
                          r="45"
                          fill="none"
                          strokeWidth="10"
                          stroke="#3498db"
                          strokeDasharray="283"
                          strokeDashoffset={283 - (283 * (enhancingProgress[index] || 0)) / 100}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center">
                        {enhancingProgress[index] || 0}%
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageEnhancer;
