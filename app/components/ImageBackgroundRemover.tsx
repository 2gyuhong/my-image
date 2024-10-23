import React, { useState, useEffect } from 'react';
import Image from 'next/image'; // next/image 추가

interface ImageFile {
  file: File;
  preview: string;
  processed?: string;
  isSelected: boolean;
  width: number;
  height: number;
  processingTime?: number; // 처리 시간을 저장할 새 속성
}

const ImageBackgroundRemover: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // 이전에 선택한 파일들의 URL 해제
      selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
      
      // 선택된 파일들을 새 배열로 설정
      const newFiles: ImageFile[] = [];
      
      Array.from(event.target.files).forEach(file => {
        const img = document.createElement('img'); // 'new Image()' 대신 사용
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          newFiles.push({
            file,
            preview: img.src,
            isSelected: true,
            width: img.width,
            height: img.height
          });
          
          // 모든 파일이 처리되면 상태 업데이트
          if (newFiles.length === event.target.files!.length) {
            setSelectedFiles(newFiles);
          }
        };
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

  const handleRemoveBackground = async () => {
    const filesToProcess = selectedFiles.filter(file => file.isSelected && !file.processed);
    if (filesToProcess.length === 0) return;

    setIsLoading(true);
    setError(null);

    const updatedFiles = [...selectedFiles];

    for (const file of filesToProcess) { // 'const' 사용
      const index = selectedFiles.indexOf(file);
      const startTime = Date.now();
      try {
        const base64 = await fileToBase64(file.file);
        const response = await fetch('/api/remove-background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64.split(',')[1] }),
        });

        const result = await response.json();

        if (response.ok && result.image) {
          const endTime = Date.now();
          updatedFiles[index].processed = `data:image/png;base64,${result.image}`;
          updatedFiles[index].processingTime = endTime - startTime;
        } else {
          console.error('배경 제거 실패:', result.error);
          setError(`배경 제거 실패: ${result.error}`);
        }
      } catch (error) {
        console.error('API 호출 오류:', error);
        setError(`API 호출 오류: ${error}`);
      }
    }

    setSelectedFiles(updatedFiles);
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

  const handleDownload = (imageUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkDownload = () => {
    selectedFiles.forEach((file, index) => {
      if (file.isSelected && file.processed) {
        handleDownload(file.processed, `processed_image_${index + 1}.png`);
      }
    });
  };

  useEffect(() => {
    return () => {
      selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
    };
  }, [selectedFiles]);

  return (
    <div className="container mx-auto px-4">
      <h2 className="text-2xl font-bold mb-4">이미지 배경 지우기</h2>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        multiple
        className="mb-4 p-2 border rounded"
      />
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleRemoveBackground}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            disabled={isLoading}
          >
            {isLoading ? '처리 중...' : '배경 지우기'}
          </button>
          <button
            onClick={handleBulkDownload}
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
          >
            전체 다운로드
          </button>
        </div>
      )}
      {error && <p className="text-red-500 mt-2 mb-4">{error}</p>}
      <div className="space-y-8">
        {selectedFiles.map((file, index) => (
          <div key={index} className="flex gap-4 items-start border p-4 rounded">
            <input
              type="checkbox"
              checked={file.isSelected}
              onChange={() => handleCheckboxChange(index)}
              className="mt-2"
            />
            <div className="w-1/2">
              <h3 className="text-xl font-bold mb-2">
                원본 이미지: {file.width} x {file.height} 픽셀
              </h3>
              <Image 
                src={file.preview} 
                alt={`Selected ${index}`} 
                width={500} 
                height={300} 
                layout="responsive"
              />
            </div>
            <div className="w-1/2">
              <h3 className="text-xl font-bold mb-2">
                처리된 이미지:
                {file.processingTime && ` (처리 시간: ${formatProcessingTime(file.processingTime)})`}
              </h3>
              {file.isSelected && file.processed ? (
                <div>
                  <Image 
                    src={file.processed} 
                    alt={`Processed ${index}`} 
                    width={500} 
                    height={300} 
                    layout="responsive"
                  />
                  <button
                    onClick={() => file.processed && handleDownload(file.processed, `processed_image_${index + 1}.png`)}
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-sm"
                  >
                    다운로드
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ImageBackgroundRemover;
