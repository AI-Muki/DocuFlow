import React from 'react';
import {
  FileText,
  GitFork,
  CheckSquare,
  FileCheck,
  Search,
  BarChart3,
  Calendar,
  Layers,
  Database,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Badge } from '../ui/badge.tsx';
import { Button } from '../ui/button.tsx';
import type { NavSection } from '../layout/sidebar.tsx';

export interface ComingSoonViewProps {
  section: NavSection;
  onBackToDashboard: () => void;
}

const MODULE_DETAILS: Record<
  Exclude<NavSection, 'dashboard' | 'settings'>,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    phase: string;
    targetMilestones: string[];
    schemaEntity: string;
  }
> = {
  documents: {
    title: 'Document Management & Intelligence',
    description: 'Centralized repository with automated classification, metadata extraction, and OCR indexing.',
    icon: FileText,
    phase: 'Phase 2 (Milestone M2.1)',
    targetMilestones: [
      'Multi-format file upload (PDF, DOCX, TIFF, scans)',
      'OCR text extraction & intelligent key-value field extraction',
      'AI Document classification and semantic tagging',
      'Version control, immutable audit trails, and retention policies',
    ],
    schemaEntity: 'model Document (Prepared in schema.prisma)',
  },
  workflows: {
    title: 'Workflow Automation & Routing',
    description: 'Configurable business process orchestration engine routing documents through multi-step lifecycles.',
    icon: GitFork,
    phase: 'Phase 3 (Milestone M3.1)',
    targetMilestones: [
      'Visual DAG workflow builder with branch logic',
      'Automated routing by department and document type',
      'Event-driven triggers (upload, approve, timeout)',
      'Escalation rules and fallback assignees',
    ],
    schemaEntity: 'model Workflow (Prepared in schema.prisma)',
  },
  tasks: {
    title: 'Tasks & Deadline Tracking',
    description: 'Operational queues managing document reviews, data verifications, and compliance checklists.',
    icon: CheckSquare,
    phase: 'Phase 3 (Milestone M3.2)',
    targetMilestones: [
      'Task assignments and priority queues',
      'SLA monitoring and due-date alerts',
      'Departmental task balancing',
      'Completion checklist verification',
    ],
    schemaEntity: 'model Task (Prepared in schema.prisma)',
  },
  approvals: {
    title: 'Multi-Tier Approvals',
    description: 'Enterprise sign-off chains with cryptographic signatures, delegation, and strict role compliance.',
    icon: FileCheck,
    phase: 'Phase 3 (Milestone M3.3)',
    targetMilestones: [
      'Sequential and parallel approval chains',
      'Manager, director, and executive approval gates',
      'Digital signature stamps and audit compliance',
      'Reason for rejection and revision loops',
    ],
    schemaEntity: 'model Approval (Prepared in schema.prisma)',
  },
  search: {
    title: 'Intelligent Enterprise Search',
    description: 'Hybrid semantic vector search and exact keyword query engine across all organizational records.',
    icon: Search,
    phase: 'Phase 4 (Milestone M4.1)',
    targetMilestones: [
      'Full-text search with PostgreSQL tsvector indexes',
      'Vector embeddings and semantic retrieval',
      'Filter by department, date range, and metadata fields',
      'Strict multi-tenant security barrier filtering',
    ],
    schemaEntity: 'Prepared for Vector Extension (pgvector / Gemini embeddings)',
  },
  analytics: {
    title: 'Operational Analytics & Insights',
    description: 'Real-time telemetry, SLA performance dashboards, bottleneck analysis, and document throughput metrics.',
    icon: BarChart3,
    phase: 'Phase 4 (Milestone M4.2)',
    targetMilestones: [
      'Workflow cycle-time distributions',
      'Departmental throughput and review latency metrics',
      'Document volume breakdowns and growth trends',
      'Compliance and SLA adherence reports',
    ],
    schemaEntity: 'model AuditLog Aggregations & Metrics Views',
  },
};

export function ComingSoonView({ section, onBackToDashboard }: ComingSoonViewProps) {
  if (section === 'dashboard' || section === 'settings') {
    return null;
  }

  const details = MODULE_DETAILS[section];
  const Icon = details.icon;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBackToDashboard}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4 border-none">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-lg">{details.title}</CardTitle>
                <CardDescription className="text-xs mt-1">{details.description}</CardDescription>
              </div>
            </div>
            <Badge variant="warning">{details.phase}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <div className="rounded-md border border-amber-200 bg-amber-50/50 p-4 text-xs text-amber-900 leading-relaxed">
            <p className="font-semibold text-amber-950 mb-1">Architecture Boundary Notice</p>
            This module is reserved for implementation in future phases according to the DocuFlow AI roadmap.
            Phase 1 strictly establishes the foundational multi-tenant data architecture, RBAC authorization, and enterprise application shell.
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
              Planned Capabilities & Milestones
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {details.targetMilestones.map((milestone, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-700"
                >
                  <Layers className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <span>{milestone}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="font-mono text-2xs text-slate-600">{details.schemaEntity}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span>Scheduled for Next Phase</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
