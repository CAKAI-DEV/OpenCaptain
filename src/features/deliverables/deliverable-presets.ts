import type { DeliverableTypeConfig } from '../../shared/db/schema/deliverable-types';

/**
 * Preset templates for common deliverable types.
 * Includes both generic PM types (bug, feature) and content types (article, video, etc.)
 */
export const PRESET_TEMPLATES: Record<string, DeliverableTypeConfig> = {
  // Generic PM types
  bug: {
    statuses: [
      { id: 'open', name: 'Open', color: '#EF4444', isFinal: false },
      { id: 'in_progress', name: 'In Progress', color: '#F59E0B', isFinal: false },
      { id: 'testing', name: 'Testing', color: '#8B5CF6', isFinal: false },
      { id: 'resolved', name: 'Resolved', color: '#10B981', isFinal: true },
      { id: 'closed', name: 'Closed', color: '#6B7280', isFinal: true },
    ],
    transitions: [
      { from: 'open', to: 'in_progress' },
      { from: 'in_progress', to: 'testing' },
      { from: 'testing', to: 'resolved' },
      { from: 'testing', to: 'in_progress' }, // Back to dev
      { from: 'resolved', to: 'closed' },
      { from: 'resolved', to: 'open' }, // Reopen
    ],
    fields: [
      {
        id: 'severity',
        name: 'Severity',
        type: 'select',
        required: true,
        options: ['critical', 'major', 'minor', 'trivial'],
      },
      {
        id: 'environment',
        name: 'Environment',
        type: 'select',
        required: false,
        options: ['production', 'staging', 'development'],
      },
      { id: 'steps_to_reproduce', name: 'Steps to Reproduce', type: 'text', required: false },
    ],
  },

  feature: {
    statuses: [
      { id: 'backlog', name: 'Backlog', color: '#6B7280', isFinal: false },
      { id: 'spec', name: 'Specification', color: '#3B82F6', isFinal: false },
      { id: 'design', name: 'Design', color: '#8B5CF6', isFinal: false },
      { id: 'development', name: 'Development', color: '#F59E0B', isFinal: false },
      { id: 'review', name: 'Review', color: '#EC4899', isFinal: false },
      { id: 'done', name: 'Done', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'backlog', to: 'spec' },
      { from: 'spec', to: 'design' },
      { from: 'design', to: 'development' },
      { from: 'development', to: 'review' },
      { from: 'review', to: 'done' },
      { from: 'review', to: 'development' }, // Back for changes
    ],
    fields: [
      { id: 'epic', name: 'Epic', type: 'relation', required: false, relationTo: 'deliverable' },
      { id: 'story_points', name: 'Story Points', type: 'number', required: false },
    ],
  },

  // Content types
  article: {
    statuses: [
      { id: 'ideation', name: 'Ideation', color: '#6B7280', isFinal: false },
      { id: 'outline', name: 'Outline', color: '#3B82F6', isFinal: false },
      { id: 'writing', name: 'Writing', color: '#F59E0B', isFinal: false },
      { id: 'editing', name: 'Editing', color: '#8B5CF6', isFinal: false },
      { id: 'review', name: 'Review', color: '#EC4899', isFinal: false },
      { id: 'published', name: 'Published', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'ideation', to: 'outline' },
      { from: 'outline', to: 'writing' },
      { from: 'writing', to: 'editing' },
      { from: 'editing', to: 'review' },
      { from: 'review', to: 'published' },
      { from: 'review', to: 'editing' }, // Back for revisions
    ],
    fields: [
      { id: 'word_count', name: 'Target Word Count', type: 'number', required: false },
      { id: 'topic', name: 'Topic', type: 'text', required: true },
      { id: 'publish_url', name: 'Published URL', type: 'url', required: false },
    ],
  },

  video: {
    statuses: [
      { id: 'ideation', name: 'Ideation', color: '#6B7280', isFinal: false },
      { id: 'scripting', name: 'Scripting', color: '#3B82F6', isFinal: false },
      { id: 'production', name: 'Production', color: '#F59E0B', isFinal: false },
      { id: 'editing', name: 'Editing', color: '#8B5CF6', isFinal: false },
      { id: 'review', name: 'Review', color: '#EC4899', isFinal: false },
      { id: 'published', name: 'Published', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'ideation', to: 'scripting' },
      { from: 'scripting', to: 'production' },
      { from: 'production', to: 'editing' },
      { from: 'editing', to: 'review' },
      { from: 'review', to: 'published' },
      { from: 'review', to: 'editing' },
    ],
    fields: [
      {
        id: 'platform',
        name: 'Platform',
        type: 'select',
        required: true,
        options: ['YouTube', 'TikTok', 'Instagram', 'Other'],
      },
      { id: 'duration', name: 'Target Duration', type: 'text', required: false },
      { id: 'publish_url', name: 'Published URL', type: 'url', required: false },
      { id: 'thumbnail', name: 'Thumbnail', type: 'file', required: false },
    ],
  },

  social_post: {
    statuses: [
      { id: 'draft', name: 'Draft', color: '#6B7280', isFinal: false },
      { id: 'review', name: 'Review', color: '#8B5CF6', isFinal: false },
      { id: 'scheduled', name: 'Scheduled', color: '#3B82F6', isFinal: false },
      { id: 'published', name: 'Published', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'draft', to: 'review' },
      { from: 'review', to: 'scheduled' },
      { from: 'review', to: 'draft' },
      { from: 'scheduled', to: 'published' },
    ],
    fields: [
      {
        id: 'platform',
        name: 'Platform',
        type: 'multi_select',
        required: true,
        options: ['Twitter', 'LinkedIn', 'Facebook', 'Instagram', 'Threads'],
      },
      { id: 'scheduled_date', name: 'Scheduled Date', type: 'date', required: false },
      { id: 'media', name: 'Media', type: 'file', required: false },
    ],
  },

  design: {
    statuses: [
      { id: 'brief', name: 'Brief', color: '#6B7280', isFinal: false },
      { id: 'exploration', name: 'Exploration', color: '#3B82F6', isFinal: false },
      { id: 'refinement', name: 'Refinement', color: '#F59E0B', isFinal: false },
      { id: 'review', name: 'Review', color: '#8B5CF6', isFinal: false },
      { id: 'approved', name: 'Approved', color: '#10B981', isFinal: true },
    ],
    transitions: [
      { from: 'brief', to: 'exploration' },
      { from: 'exploration', to: 'refinement' },
      { from: 'refinement', to: 'review' },
      { from: 'review', to: 'approved' },
      { from: 'review', to: 'refinement' },
    ],
    fields: [
      {
        id: 'design_type',
        name: 'Design Type',
        type: 'select',
        required: true,
        options: ['UI/UX', 'Graphic', 'Illustration', 'Brand', 'Other'],
      },
      { id: 'figma_url', name: 'Figma URL', type: 'url', required: false },
      { id: 'final_files', name: 'Final Files', type: 'file', required: false },
    ],
  },
};

/**
 * Get available preset keys.
 */
export const PRESET_KEYS = Object.keys(PRESET_TEMPLATES) as Array<keyof typeof PRESET_TEMPLATES>;

/**
 * Get human-readable preset names.
 */
export const PRESET_NAMES: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature',
  article: 'Article',
  video: 'Video',
  social_post: 'Social Post',
  design: 'Design',
};
