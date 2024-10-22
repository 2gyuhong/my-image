'use client';

import { useState } from 'react';
import ImageEnhancer from './components/ImageEnhancer';
import ImageBackgroundRemover from './components/ImageBackgroundRemover';
import { MdContentCut, MdHighQuality, MdPhotoSizeSelectLarge } from 'react-icons/md';

export default function Home() {
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);

  const renderContent = () => {
    switch (selectedMenu) {
      case '이미지 배경 지우기':
        return <ImageBackgroundRemover />;
      case '이미지 화질 개선하기':
        return <ImageEnhancer />;
      default:
        return (
          <div>
            <p>왼쪽 메뉴에서 원하는 기능을 선택하세요.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* 왼쪽 메뉴 */}
      <nav className="w-64 bg-gray-100 p-4">
        <h2 className="text-xl font-bold mb-4">메뉴</h2>
        <ul>
          <li 
            className="mb-2 hover:bg-gray-200 p-2 rounded cursor-pointer flex items-center" 
            onClick={() => setSelectedMenu('이미지 배경 지우기')}
          >
            <MdContentCut className="mr-2" /> 이미지 배경 지우기
          </li>
          <li 
            className="mb-2 hover:bg-gray-200 p-2 rounded cursor-pointer flex items-center" 
            onClick={() => setSelectedMenu('이미지 화질 개선하기')}
          >
            <MdHighQuality className="mr-2" /> 이미지 화질 개선하기
          </li>
          <li 
            className="mb-2 hover:bg-gray-200 p-2 rounded cursor-pointer flex items-center" 
            onClick={() => setSelectedMenu('이미지 사이즈 변경하기')}
          >
            <MdPhotoSizeSelectLarge className="mr-2" /> 이미지 사이즈 변경하기
          </li>
        </ul>
      </nav>

      {/* 오른쪽 기능 영역 */}
      <main className="flex-1 p-8">
        {renderContent()}
      </main>
    </div>
  );
}
