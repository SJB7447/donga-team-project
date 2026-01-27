
import { createClient } from '@supabase/supabase-js';
import { Task, Requirement, MeetingLog, TeamMember } from '../types';

const SUPABASE_URL = 'https://nedtvbnodkdmofhvhpbm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H3BVdjIEBss5tSAu-oD0Pg_CixIDHV-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function fetchAllData() {
  const [tasks, requirements, meetings, teamMembers] = await Promise.all([
    supabase.from('tasks').select('*').order('created_at', { ascending: false }),
    supabase.from('requirements').select('*').order('created_at', { ascending: false }),
    supabase.from('meetings').select('*').order('created_at', { ascending: false }),
    supabase.from('team_members').select('*')
  ]);

  return {
    tasks: tasks.data || [],
    requirements: requirements.data || [],
    meetings: meetings.data || [],
    teamMembers: teamMembers.data || []
  };
}

export async function upsertTask(task: Task) {
  return supabase.from('tasks').upsert(task);
}

export async function deleteTask(id: string) {
  return supabase.from('tasks').delete().eq('id', id);
}

export async function upsertRequirement(req: Requirement) {
  return supabase.from('requirements').upsert(req);
}

export async function deleteRequirement(id: string) {
  return supabase.from('requirements').delete().eq('id', id);
}

export async function upsertMeeting(meeting: MeetingLog) {
  return supabase.from('meetings').upsert(meeting);
}

export async function deleteMeeting(id: string) {
  return supabase.from('meetings').delete().eq('id', id);
}

export async function upsertMember(member: TeamMember) {
  return supabase.from('team_members').upsert(member);
}

export async function deleteMember(id: string) {
  return supabase.from('team_members').delete().eq('id', id);
}
