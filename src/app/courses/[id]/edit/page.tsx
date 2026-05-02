import { notFound, redirect } from 'next/navigation';

import CourseSubmit from '@/components/course-submit';
import { createClient } from '@/lib/supabase/server';
import { fetchCourseDetail } from '@/services/course/courseDetailService';

interface CourseEditPageProps {
  params: { id: string };
}

export default async function CourseEditPage({ params }: CourseEditPageProps) {
  const fetchedData = await fetchCourseDetail(params.id);

  if (!fetchedData) {
    notFound();
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id !== fetchedData.course.user_id) {
    redirect(`/courses/${params.id}`);
  }

  return <CourseSubmit mode="edit" courseId={params.id} initialData={fetchedData} />;
}
