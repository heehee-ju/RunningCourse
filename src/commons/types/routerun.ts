// types/routerun.ts
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  profile_image_url?: string;
}

export interface Route {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  distance_meters: number;
  path_data: Record<string, unknown>; // Tmap 경로 JSON 데이터
  start_lat: number;
  start_lng: number;
  start_address_region?: string | null;
  image_urls: string[];
  likes_count: number;
  is_round_trip: boolean;
  created_at: string;
}

export type ReferenceLocationType = 'CURRENT_USER_LOCATION' | 'SEOUL_CITY_HALL_DEFAULT';

export interface ReferenceLocation {
  type: ReferenceLocationType;
  lat: number;
  lng: number;
}

export interface CourseCardView {
  courseId: string;
  title: string;
  location: string;
  distanceKm: number;
  distanceFromReference: number;
  distanceText: string;
  likeCount: number;
  isPinnedTop: boolean;
  thumbnailUrl?: string;
}

// 홈 페이지(지도)에서 쓰는 뷰포트 경계 타입
export type RouteViewport = {
  northEastLat: number;
  northEastLng: number;
  southWestLat: number;
  southWestLng: number;
};
