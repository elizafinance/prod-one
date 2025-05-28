import { redirect } from 'next/navigation';

export default function SquadsIndexPage() {
  redirect('/squads/my');
  return null;
} 