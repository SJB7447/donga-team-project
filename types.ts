
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type ReqCategory = 'requirement' | 'guideline' | 'reference';

export interface Task {
  id: string;
  title: string;
  assignee: string;
  role: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  deadline: string;
  progress: number;
  issue: string;
  createdAt: number;
  attachmentName?: string;
  attachmentType?: 'image' | 'file';
  attachmentData?: string;
}

export interface Requirement {
  id: string;
  title: string;
  category: ReqCategory;
  content: string;
  link?: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'file';
  attachmentData?: string;
  createdAt: number;
}

export interface MeetingLog {
  id: string;
  title: string;
  date: string;
  attendees: string;
  content: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'file';
  attachmentData?: string;
  createdAt: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
}

export interface AIProgressResult {
  percentage: number;
  reasoning: string;
}
