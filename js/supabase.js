/* ScholaSync — supabase.js
 * When CONFIG.url and CONFIG.anonKey are filled in, registration reserves a
 * globally-unique student ID from Supabase. Otherwise, the app stays fully
 * local (single-device prototype).
 *
 * SQL to run once in Supabase (SQL editor):
 *
 *   create table schools (abbr text primary key check (abbr ~ '^[A-Z]{2,5}$'), name text not null);
 *   create table school_counters (school text primary key references schools(abbr), next_counter bigint not null default 0);
 *   create or replace function allocate_student_id(p_school text) returns bigint language plpgsql as $$
 *   declare v bigint;
 *   begin
 *     update school_counters set next_counter = next_counter + 1
 *       where school = p_school returning next_counter - 1 into v;
 *     if v is null then raise exception 'Unknown school %', p_school; end if;
 *     return v;
 *   end $$;
 *
 * Then add a row per pilot school:
 *   insert into schools values ('UNN', 'University of Nigeria Secondary School'), ('CSS', 'Community Secondary School');
 *   insert into school_counters values ('UNN', 0), ('CSS', 0);
 */
(function (root) {
  'use strict';

  var CONFIG = {
    url: 'https://hosipziojpsgtjqlahle.supabase.co',        // e.g. 'https://xxxx.supabase.co'
    anonKey: 'sb_publishable_LyOi3KXK06mnN-rH_DKpeA_ipv2tVI5'     // project anon key (safe to expose in browser)
  };

  function isConfigured() {
    return !!(CONFIG.url && CONFIG.anonKey);
  }

  async function reserveStudentId(schoolAbbr) {
    if (!isConfigured()) return null;
    var res = await fetch(CONFIG.url + '/rest/v1/rpc/allocate_student_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.anonKey,
        'Authorization': 'Bearer ' + CONFIG.anonKey
      },
      body: JSON.stringify({ p_school: schoolAbbr })
    });
    if (!res.ok) {
      var t = await res.text().catch(function () { return ''; });
      throw new Error('ID allocation failed (' + res.status + '): ' + t);
    }
    return await res.json();
  }

  root.ScholaSupabase = {
    config: CONFIG,
    isConfigured: isConfigured,
    reserveStudentId: reserveStudentId
  };
})(window);