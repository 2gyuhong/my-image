import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.log('API 호출 시작');
  
  let requestBody;
  try {
    requestBody = await request.json();
    console.log('요청 본문 길이:', requestBody.image.length);
  } catch (error) {
    console.error('요청 본문 파싱 오류:', error);
    return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }

  const { image } = requestBody;

  if (!image) {
    console.error('이미지 데이터가 없습니다.');
    return NextResponse.json({ error: '이미지 데이터가 없습니다.' }, { status: 400 });
  }

  if (!process.env.VMAKE_API_KEY) {
    console.error('VMAKE_API_KEY is not set');
    return NextResponse.json({ error: 'API key is not configured' }, { status: 500 });
  }

  try {
    console.log('Vmake AI API 호출 시작');
    const response = await fetch('https://open.vmake.ai/api/v1/image/remove-background', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.VMAKE_API_KEY,
      },
      body: JSON.stringify({ image }),
    });

    console.log('Vmake AI API 응답 상태:', response.status);

    const data = await response.json();
    console.log('Vmake AI API 응답 데이터:', data);

    if (data.code !== 0) {
      console.error(`API 요청 실패: ${data.message}`);
      return NextResponse.json({ error: data.message }, { status: 400 });
    }

    if (!data.data || !data.data.image) {
      console.error('API 응답에 이미지 데이터가 없습니다:', data);
      return NextResponse.json({ error: '이미지 데이터가 없습니다.' }, { status: 500 });
    }

    return NextResponse.json({ image: data.data.image });
  } catch (error) {
    console.error('배경 제거 API 오류:', error);
    return NextResponse.json({ error: '배경 제거 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
