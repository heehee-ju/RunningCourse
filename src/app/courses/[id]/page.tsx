import { notFound } from 'next/navigation';

import CoursesWireframe from '@/components/courses-detail';
import { createClient } from '@/lib/supabase/server';
import { fetchCourseDetail } from '@/services/course/courseDetailService';

interface CourseDetailPageProps {
  params: { id: string };
}

export default async function CoursesPage({ params }: CourseDetailPageProps) {
  const detail = await fetchCourseDetail(params.id);
  if (!detail) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const canEdit = user?.id === detail.course.user_id;

  return (
    <CoursesWireframe
      course={detail.course}
      authorNickname={detail.authorNickname}
      location={detail.location}
      canEdit={canEdit}
    />
  );
}
