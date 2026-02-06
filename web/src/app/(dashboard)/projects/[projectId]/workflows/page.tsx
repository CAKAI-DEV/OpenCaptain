import { WorkflowEditor } from '@/components/workflow';
import '@xyflow/react/dist/style.css';

interface WorkflowsPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function WorkflowsPage({ params }: WorkflowsPageProps) {
  const { projectId } = await params;

  // TODO: Fetch existing workflow configuration from API
  // const workflow = await fetchWorkflow(projectId);

  return (
    <div className="h-[calc(100vh-4rem)]">
      <WorkflowEditor
        initialNodes={[]}
        initialEdges={[]}
        onSave={(nodes, edges) => {
          // TODO: POST to /api/v1/projects/{projectId}/workflows
          console.log('Saving workflow for project:', projectId, { nodes, edges });
        }}
      />
    </div>
  );
}
