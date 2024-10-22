import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');

  if (!taskId) {
    return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
  }

  if (!process.env.VMAKE_API_KEY) {
    console.error('VMAKE_API_KEY is not set');
    return NextResponse.json({ error: 'API key is not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`https://open.vmake.ai/api/v1/image/quality-enhance/${taskId}`, {
      headers: {
        'x-api-key': process.env.VMAKE_API_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (data.code !== 0) {
      return NextResponse.json({ status: 'error', message: data.message });
    }

    if (data.data.status === 'success') {
      return NextResponse.json({ status: 'success', image: data.data.downloadUrl });
    } else if (data.data.status === 'error') {
      return NextResponse.json({ status: 'error', message: data.data.message });
    } else {
      return NextResponse.json({ status: 'pending' });
    }
  } catch (error) {
    console.error('상태 확인 API 오류:', error);
    return NextResponse.json({ error: '상태 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
