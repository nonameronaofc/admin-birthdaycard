import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Panel pendapatan sudah dipindahkan ke web owner.' },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: 'Panel pendapatan sudah dipindahkan ke web owner.' },
    { status: 410 }
  );
}
