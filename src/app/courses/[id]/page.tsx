import { notFound } from 'next/navigation';

import CoursesWireframe from '@/components/courses-detail';
import { createClient } from '@/lib/supabase/server';
import { fetchCourseDetail } from '@/services/course/courseDetailService';

import type { Metadata } from 'next';

interface CourseDetailPageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: CourseDetailPageProps): Promise<Metadata> {
  const detail = await fetchCourseDetail(params.id);
  if (!detail) return {};

  const { course, location } = detail;
  const distanceKm = (course.distance_meters / 1000).toFixed(1);
  const description = course.description?.trim() || `${location} 근처의 ${distanceKm}km 러닝 코스`;
  const ogImage = course.image_urls[0] ?? '/icons/rr-logo.png';

  return {
    title: `${course.title} | 루트런`,
    description,
    openGraph: {
      title: course.title,
      description,
      locale: 'ko_KR',
      type: 'article',
      images: [{ url: ogImage, alt: course.title }],
    },
  };
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
