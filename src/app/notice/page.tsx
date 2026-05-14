import { NoticeSeenTracker } from '@/components/notice/notice-seen-tracker';
import { StaticInfoPage } from '@/components/static-info-page';

export default function NoticePage() {
  return (
    <>
      <NoticeSeenTracker />
      <StaticInfoPage title="공지사항" description="공지 내용은 곧 안내될 예정입니다." />
    </>
  );
}
