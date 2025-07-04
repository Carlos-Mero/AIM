export async function generateStaticParams() {
  return [
    { projectId: '1' },
    { projectId: '2' },
    { projectId: '3' },
  ];
}

import ProjectDetailPage from '../page';

export default function ProjectIdPage() {
  return <ProjectDetailPage />;
}
