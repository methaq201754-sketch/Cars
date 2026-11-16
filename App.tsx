import "react-native-url-polyfill/auto";
import React, { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View, ActivityIndicator, Modal
} from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

const SUPABASE_URL = "https://gzjkikvvdtjpoxrrwvmi.supabase.co";
// Supabase public client key only.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6amtpa3Z2ZHRqcG94cnJ3dm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5Njg5MTksImV4cCI6MjEwOTU0NDkxOX0.uS6_ozaKf9QLDU63kg999dipR0jBejibnQHcm55MzSs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
});

const C = { primary:"#C0272D", dark:"#9E1F24", orange:"#FF7A45", bg:"#F4F7FB", text:"#20252B", muted:"#68727D", border:"#D9DEE5", success:"#18864B", pale:"#FFF5EF" };
const DEPARTMENTS = ["الموارد البشرية","التخطيط والمخازن","الجودة والبحث والتطوير","الصيانة","المبيعات والتسويق","الرقابة والمراجعة الداخلية","الصفيح","المالية","إنتاج الطلاء","إنتاج الجاما"];
const GRADES = ["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة","السابعة","الثامنة","التاسعة"];
const QUALIFICATIONS = ["تعليم أساسي","ثانوية عامة","دبلوم","جامعي"];
const SCALE_1: [number,string][] = [[5,"راضي تماماً"],[4,"راضي"],[3,"محايد"],[2,"غير راضي"],[1,"غير راضي إطلاقاً"]];
const SCALE_2: [number,string][] = [[5,"ممتاز"],[4,"جيد جداً"],[3,"جيد"],[2,"مقبول"],[1,"ضعيف"]];

type Question = { question_no:number; domain_no:number; domain_name:string; question_text:string; is_morale_question?:boolean };
type Period = { survey_id:number; start_at:string|null; end_at:string|null; is_enabled:boolean };
type Survey = { id:number; survey_code:string; survey_name:string; description?:string; is_active:boolean; period:Period|null; questions:Question[] };
type Employee = { employee_number:string; employee_name:string; is_survey_admin:boolean };
type ResponseRow = { id:number; survey_id:number; employee_number:string; employee_name:string|null; department:string; job_grade:string; service_years:number; qualification:string; morale_reason:string|null; domain1_average:number|null; domain2_average:number|null; domain3_average:number|null; overall_average:number|null; submitted_at:string; answers?:any[] };
type WorkflowData = { branches:any[]; employees:any[]; managers:any[]; branch_approvers:any[] };

const avg = (a:number[]) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
const dateOpen = (p:Period|null) => !!p && p.is_enabled && (!p.start_at || new Date(p.start_at).getTime() <= Date.now()) && (!p.end_at || new Date(p.end_at).getTime() >= Date.now());
const errText = (e:any) => e?.message || e?.details || "حدث خطأ غير متوقع.";
const escapeCsv = (v:any) => `"${String(v ?? "").replace(/"/g,'""')}"`;
const pick = (row:any, keys:string[], fallback:any="") => { for(const k of keys){ if(row?.[k]!==undefined && row?.[k]!==null) return row[k]; } return fallback; };
const asArray = (v:any) => Array.isArray(v)?v:[];
const normalizeWorkflowData = (raw:any):WorkflowData => {
  let d=raw;
  if(Array.isArray(d) && d.length===1 && d[0] && typeof d[0]==="object") d=d[0];
  if(d?.data && typeof d.data==="object") d=d.data;
  return {
    branches:asArray(pick(d,["branches","workflow_branches","branch_list"])),
    employees:asArray(pick(d,["employees","employee_list","staff"])),
    managers:asArray(pick(d,["managers","manager_list","direct_managers"])),
    branch_approvers:asArray(pick(d,["branch_approvers","approvers","branchApprovers"]))
  };
};
const employeeNoOf = (r:any) => String(pick(r,["employee_number","manager_employee_number","approver_employee_number","assigned_employee_number","user_employee_number","number","employeeNo"]));
const employeeNameOf = (r:any) => String(pick(r,["employee_name","manager_employee_name","approver_employee_name","assigned_employee_name","user_employee_name","display_name","name"],"موظف"));
const branchCodeOf = (r:any) => String(pick(r,["branch_code","code"]));
const branchNameOf = (r:any) => String(pick(r,["branch_name","name","branch"]));

export default function App() {
  const [screen,setScreen] = useState<"login"|"dashboard"|"home"|"employee"|"survey"|"result"|"admin"|"workflow"|"employees">("login");
  const [employeeNo,setEmployeeNo] = useState("");
  const [password,setPassword] = useState("");
  const [employee,setEmployee] = useState<Employee|null>(null);
  const [roleCodes,setRoleCodes] = useState<string[]>([]);
  const [permissions,setPermissions] = useState<Record<string,boolean>>({});
  const [systemAdmin,setSystemAdmin] = useState(false);
  const [catalog,setCatalog] = useState<Survey[]>([]);
  const [selectedSurvey,setSelectedSurvey] = useState<Survey|null>(null);
  const [department,setDepartment] = useState("");
  const [grade,setGrade] = useState("");
  const [years,setYears] = useState("");
  const [qualification,setQualification] = useState("");
  const [answers,setAnswers] = useState<Record<number,number>>({});
  const [reason,setReason] = useState("");
  const [busy,setBusy] = useState(false);
  const [result,setResult] = useState<any>(null);
  const [adminSurveyId,setAdminSurveyId] = useState(1);
  const [adminRows,setAdminRows] = useState<ResponseRow[]>([]);
  const [selectedResponse,setSelectedResponse] = useState<number|null>(null);
  const [periodStart,setPeriodStart] = useState("");
  const [periodEnd,setPeriodEnd] = useState("");
  const [periodEnabled,setPeriodEnabled] = useState(false);
  const [workflowData,setWorkflowData] = useState<WorkflowData>({branches:[],employees:[],managers:[],branch_approvers:[]});
  const [workflowSearch,setWorkflowSearch] = useState("");
  const [workflowSelectedEmployee,setWorkflowSelectedEmployee] = useState<any>(null);
  const [workflowBranch,setWorkflowBranch] = useState("NAQIL");
  const [workflowManager,setWorkflowManager] = useState("");
  const [workflowApproverRole,setWorkflowApproverRole] = useState<"SERVICES_ADMIN"|"REQUEST_AUDITOR">("SERVICES_ADMIN");
  const [workflowApproverEmployee,setWorkflowApproverEmployee] = useState("");
  const [workflowPicker,setWorkflowPicker] = useState<null|"employee"|"manager"|"bulkManager"|"bulkEmployees">(null);
  const [workflowPickerSearch,setWorkflowPickerSearch] = useState("");
  const [workflowBulkManager,setWorkflowBulkManager] = useState("");
  const [workflowBulkEmployees,setWorkflowBulkEmployees] = useState<string[]>([]);
  const [employeesRows,setEmployeesRows] = useState<any[]>([]);
  const [employeeSearch,setEmployeeSearch] = useState("");
  const [selectedEmployeeRecord,setSelectedEmployeeRecord] = useState<any>(null);
  const [editEmployeeJobTitle,setEditEmployeeJobTitle] = useState("");
  const [editEmployeeDepartment,setEditEmployeeDepartment] = useState("");
  const [editEmployeeActive,setEditEmployeeActive] = useState(true);

  const questions = selectedSurvey?.questions || [];
  const progress = useMemo(()=>questions.length ? Math.round(Object.keys(answers).length/questions.length*100) : 0,[answers,questions.length]);
  const activeAdminSurvey = catalog.find(x=>x.id===adminSurveyId);
  const adminStats = useMemo(()=>({
    count:adminRows.length,
    overall:avg(adminRows.map(x=>Number(x.overall_average)||0)),
    d1:avg(adminRows.map(x=>Number(x.domain1_average)||0)),
    d2:avg(adminRows.map(x=>Number(x.domain2_average)||0)),
    d3:avg(adminRows.map(x=>Number(x.domain3_average)||0))
  }),[adminRows]);

  const loadCatalog = async () => {
    const {data,error} = await supabase.rpc("get_survey_catalog");
    if(error) throw error;
    const list = (Array.isArray(data) ? data : data?.surveys || []) as Survey[];
    setCatalog(list);
    return list;
  };

  const loadAuthenticatedContext = async (authUser:any) => {
    const {data:profile,error:profileError} = await supabase
      .from("user_profiles")
      .select("user_id,employee_id,display_name,is_active")
      .eq("user_id",authUser.id)
      .maybeSingle();
    if(profileError) throw profileError;
    if(!profile || profile.is_active !== true)
      throw new Error("لا يوجد ملف مستخدم فعال مرتبط بهذا الحساب. يرجى مراجعة مسؤول النظام.");

    // Extract the employee number from the login email: emp-<number>@hr.company.invalid
    const email = String(authUser.email || "").trim().toLowerCase();
    const emailMatch = email.match(/^emp-(.+)@hr\.company\.invalid$/);
    const loginEmployeeNumber = emailMatch?.[1]?.trim() || "";

    let empRow:any = null;

    // First try the employee UUID linked to the user profile.
    if(profile.employee_id){
      const {data,error} = await supabase
        .from("employees")
        .select("id,employee_number,employee_name,is_active,employment_status")
        .eq("id",profile.employee_id)
        .maybeSingle();
      if(error) throw error;
      empRow = data;
    }

    // If the profile link is missing or stale, use the employee number from the authenticated login.
    if(!empRow && loginEmployeeNumber){
      const {data,error} = await supabase
        .from("employees")
        .select("id,employee_number,employee_name,is_active,employment_status")
        .eq("employee_number",loginEmployeeNumber)
        .maybeSingle();
      if(error) throw error;
      empRow = data;
    }

    if(!empRow)
      throw new Error("لم يتم العثور على سجل الموظف المرتبط بالحساب. تحقق من ربط employee_id أو تطابق الرقم الوظيفي في سجل الموظفين.");

    // Never allow an account to load a different employee's record.
    if(loginEmployeeNumber && String(empRow.employee_number) !== loginEmployeeNumber)
      throw new Error("رقم الموظف المرتبط بالحساب لا يطابق رقم الدخول. راجع مسؤول النظام لتصحيح الربط.");

    // employees.is_active is the authoritative login flag. employment_status may be
    // NULL or use legacy labels in migrated employee records; do not reject those.
    if(empRow.is_active !== true)
      throw new Error("ملف الموظف غير مفعل في سجل الموظفين. راجع مسؤول النظام لتفعيل is_active.");

    const {data:userRoleRows,error:rolesError} = await supabase
      .from("user_roles").select("role_id").eq("user_id",authUser.id);
    if(rolesError) throw rolesError;
    const roleIds=(userRoleRows||[]).map((x:any)=>x.role_id);
    let codes:string[]=[];
    if(roleIds.length){
      const {data:roleRows,error:roleError}=await supabase
        .from("roles").select("role_code").in("id",roleIds).eq("is_active",true);
      if(roleError) throw roleError;
      codes=(roleRows||[]).map((x:any)=>x.role_code);
    }
    setRoleCodes(codes);

    const permissionCodes=["SURVEYS_VIEW","SURVEYS_MANAGE","ASSETS_VIEW","GRIEVANCES_VIEW","GRIEVANCES_CREATE","IDEAS_VIEW","IDEAS_CREATE","SERVICES_VIEW","SERVICES_CREATE","REPORTS_VIEW","EMPLOYEES_VIEW","EMPLOYEES_UPDATE","USERS_MANAGE","SETTINGS_MANAGE"];
    const permissionResults=await Promise.all(permissionCodes.map(async code=>{
      const {data,error}=await supabase.rpc("has_permission",{p_permission_code:code});
      if(error) return [code,false] as [string,boolean];
      return [code,data===true] as [string,boolean];
    }));
    const permissionMap=Object.fromEntries(permissionResults);
    setPermissions(permissionMap);
    const {data:isAdmin,error:adminCheckError}=await supabase.rpc("is_system_admin");
    const adminFlag =
      isAdmin === true ||
      String(isAdmin ?? "").toLowerCase() === "true" ||
      isAdmin?.is_system_admin === true ||
      isAdmin?.is_system_admin === "true" ||
      (Array.isArray(isAdmin) && isAdmin.some((r:any)=>r?.is_system_admin === true || r?.is_system_admin === "true"));
    // Fallback: read role codes through the FK relationship if the separate
    // role lookup returned no rows because of a restricted roles SELECT policy.
    let finalRoleCodes = codes;
    if (!finalRoleCodes.length) {
      const {data:joinedRoles} = await supabase
        .from("user_roles")
        .select("role:roles(role_code,is_active)")
        .eq("user_id",authUser.id);
      finalRoleCodes = (joinedRoles||[])
        .map((r:any)=>Array.isArray(r.role)?r.role[0]?.role_code:r.role?.role_code)
        .filter(Boolean);
      if (finalRoleCodes.length) setRoleCodes(finalRoleCodes);
    }
    const isSystemAdministrator = adminFlag || finalRoleCodes.includes("SYSTEM_ADMIN");
    setSystemAdmin(isSystemAdministrator);
    if (adminCheckError) console.warn("is_system_admin check:", adminCheckError.message);

    let surveyAdmin=false;
    try{
      const {data:surveyEmployee}=await supabase.rpc("get_survey_employee",{p_employee_number:empRow.employee_number});
      const surveyRow=Array.isArray(surveyEmployee)?surveyEmployee[0]:surveyEmployee;
      surveyAdmin=!!surveyRow?.is_survey_admin;
    }catch(_e){ surveyAdmin=false; }

    const emp:Employee={
      employee_number:empRow.employee_number,
      employee_name:profile.display_name||empRow.employee_name,
      is_survey_admin:surveyAdmin || permissionMap.SURVEYS_MANAGE===true || isSystemAdministrator
    };
    setEmployee(emp);
    setEmployeeNo(emp.employee_number);
    setScreen("dashboard");
  };

  const login = async () => {
    const no=employeeNo.trim();
    if(!no || !password){Alert.alert("بيانات الدخول","أدخل الرقم الوظيفي وكلمة المرور.");return;}
    if(!/^[0-9A-Za-z-]{3,30}$/.test(no)){Alert.alert("الرقم الوظيفي غير صحيح","تحقق من الرقم الوظيفي.");return;}
    const email=`emp-${no}@hr.company.invalid`;
    setBusy(true);
    try{
      const {data,error}=await supabase.auth.signInWithPassword({email,password});
      if(error) throw error;
      if(!data.user) throw new Error("تعذر التحقق من حساب المستخدم.");
      await loadAuthenticatedContext(data.user);
    }catch(e:any){
      await supabase.auth.signOut();
      Alert.alert("تعذر تسجيل الدخول",errText(e));
    }finally{setBusy(false);}
  };

  useEffect(()=>{
    let alive=true;
    supabase.auth.getSession().then(async ({data,error})=>{
      if(!alive || error || !data.session?.user) return;
      setBusy(true);
      try{await loadAuthenticatedContext(data.session.user);}
      catch(e:any){await supabase.auth.signOut(); if(alive) Alert.alert("تعذر استعادة الجلسة",errText(e));}
      finally{if(alive) setBusy(false);}
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT" && alive){setEmployee(null);setRoleCodes([]);setPermissions({});setSystemAdmin(false);setScreen("login");}
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[]);

  const loadAdmin = async (surveyId:number, empNo=employee?.employee_number) => {
    if(!empNo) return;
    setBusy(true);
    try {
      const {data,error} = await supabase.rpc("get_survey_admin_dashboard",{p_employee_number:empNo,p_survey_id:surveyId});
      if(error) throw error;
      const rows = Array.isArray(data) ? data : data?.responses || [];
      setAdminRows(rows as ResponseRow[]);
    } catch(e:any){Alert.alert("تعذر تحميل لوحة المدير",errText(e));}
    finally{setBusy(false);}
  };

  const chooseSurvey = async (survey:Survey) => {
    if(!survey.is_active){Alert.alert("الاستبيان غير متاح","هذا الاستبيان غير مفعل حالياً.");return;}
    if(!dateOpen(survey.period)){Alert.alert("الاستبيان مغلق","لم يتم فتح هذا الاستبيان حالياً أو أن فترة المشاركة انتهت.");return;}
    if(!survey.questions?.length){Alert.alert("لا توجد أسئلة","لم يتم تحميل أسئلة هذا الاستبيان.");return;}
    setSelectedSurvey(survey); setAnswers({}); setReason(""); setDepartment(""); setGrade(""); setYears(""); setQualification(""); setScreen("employee");
  };

  const validateEmployee = () => {
    const y=Number(years);
    if(!department) return "اختر القسم.";
    if(!grade) return "اختر الدرجة الوظيفية.";
    if(!Number.isInteger(y)||y<1||y>30) return "أدخل سنوات خدمة من 1 إلى 30.";
    if(!qualification) return "اختر المؤهل.";
    return null;
  };

  const startSurvey = async () => {
    const v=validateEmployee(); if(v){Alert.alert("بيانات ناقصة",v);return;}
    if(!employee || !selectedSurvey) return;
    setBusy(true);
    try {
      const {data,error}=await supabase.rpc("check_survey_submission",{p_employee_number:employee.employee_number,p_survey_id:selectedSurvey.id});
      if(error) throw error;
      if(data===true){Alert.alert("مشاركة سابقة","سبق لك المشاركة في هذا الاستبيان.");return;}
      setScreen("survey");
    } catch(e:any){Alert.alert("تعذر التحقق",errText(e));}
    finally{setBusy(false);}
  };

  const submit = async () => {
    if(!selectedSurvey || !employee) return;
    if(Object.keys(answers).length!==questions.length){Alert.alert("الاستبيان غير مكتمل",`المتبقي ${questions.length-Object.keys(answers).length} سؤالاً.`);return;}
    setBusy(true);
    try {
      const payload = questions.map(q=>({question_no:q.question_no,domain_no:q.domain_no,answer_value:answers[q.question_no]}));
      let data:any, error:any;
      if(selectedSurvey.id===1){
        const r=await supabase.rpc("submit_survey_1_response",{
          p_employee_number:employee.employee_number,p_department:department,p_job_grade:grade,
          p_service_years:Number(years),p_qualification:qualification,p_morale_reason:reason.trim()||null,p_answers:payload
        }); data=r.data; error=r.error;
      } else if(selectedSurvey.id===2){
        const r=await supabase.rpc("submit_survey_2_response",{
          p_employee_number:employee.employee_number,p_department:department,p_job_grade:grade,
          p_service_years:Number(years),p_qualification:qualification,
          p_answers:questions.map(q=>({question_no:q.question_no,answer_value:answers[q.question_no]}))
        }); data=r.data; error=r.error;
      } else { throw new Error("لا توجد دالة حفظ مخصصة لهذا الاستبيان."); }
      if(error) throw error;
      const d1=avg(questions.filter(q=>q.domain_no===1).map(q=>answers[q.question_no]));
      const d2=avg(questions.filter(q=>q.domain_no===2).map(q=>answers[q.question_no]));
      const d3=avg(questions.filter(q=>q.domain_no===3).map(q=>answers[q.question_no]));
      const total=avg(questions.map(q=>answers[q.question_no]));
      setResult({d1,d2,d3,total,server:data}); setScreen("result");
    } catch(e:any){Alert.alert("فشل الحفظ",errText(e));}
    finally{setBusy(false);}
  };

  const updatePeriod = async () => {
    if(!employee) return;
    const validIso=(v:string)=>!v.trim() || !Number.isNaN(Date.parse(v));
    if(!validIso(periodStart)||!validIso(periodEnd)){Alert.alert("صيغة التاريخ غير صحيحة","استخدم ISO 8601 مثل 2026-11-07T08:00:00+03:00");return;}
    if(periodStart.trim()&&periodEnd.trim()&&new Date(periodEnd).getTime()<=new Date(periodStart).getTime()){Alert.alert("الفترة غير صحيحة","تاريخ النهاية يجب أن يكون بعد تاريخ البداية.");return;}
    setBusy(true);
    try{
      const {error}=await supabase.rpc("set_survey_period",{
        p_employee_number:employee.employee_number,p_survey_id:adminSurveyId,
        p_start_at:periodStart.trim()||null,p_end_at:periodEnd.trim()||null,p_is_enabled:periodEnabled
      });
      if(error) throw error;
      const list=await loadCatalog();
      Alert.alert("تم الحفظ","تم تحديث فترة الاستبيان.");
      await loadAdmin(adminSurveyId,employee.employee_number);
    }catch(e:any){Alert.alert("تعذر تحديث الفترة",errText(e));}
    finally{setBusy(false);}
  };

  const exportCsv = async () => {
    if(!activeAdminSurvey) return;
    const qHeaders=(activeAdminSurvey.questions||[]).map(q=>`س${q.question_no}`);
    const header=["رقم الموظف","اسم الموظف","القسم","الدرجة الوظيفية","سنوات الخدمة","المؤهل","المجال الأول","المجال الثاني","المجال الثالث","المتوسط العام","تاريخ الإرسال",...qHeaders];
    const lines=adminRows.map(r=>{
      const answerMap:Record<number,number>={}; (r.answers||[]).forEach((a:any)=>{answerMap[Number(a.question_no)]=Number(a.answer_value);});
      return [r.employee_number,r.employee_name,r.department,r.job_grade,r.service_years,r.qualification,r.domain1_average,r.domain2_average,r.domain3_average,r.overall_average,r.submitted_at,...qHeaders.map((_,i)=>answerMap[i+1]??"")].map(escapeCsv).join(",");
    });
    const csv="\uFEFF"+[header.map(escapeCsv).join(","),...lines].join("\r\n");
    try{
      const path=(FileSystem.cacheDirectory||"")+`survey_${adminSurveyId}_${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path,csv,{encoding:FileSystem.EncodingType.UTF8});
      if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(path,{mimeType:"text/csv",dialogTitle:"تصدير نتائج الاستبيان"});
      else Alert.alert("تم إنشاء الملف",path);
    }catch(e:any){Alert.alert("تعذر التصدير",errText(e));}
  };

  const exportPdf = async () => {
    if(!activeAdminSurvey) return;
    const rows=adminRows.map(r=>`<tr><td>${html(r.employee_number)}</td><td>${html(r.employee_name||"")}</td><td>${html(r.department)}</td><td>${Number(r.overall_average||0).toFixed(2)}</td><td>${html(new Date(r.submitted_at).toLocaleString("ar"))}</td></tr>`).join("");
    const doc=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><style>body{font-family:Arial;padding:24px;color:#20252b}h1{color:#9E1F24}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #ddd;padding:8px;text-align:right;font-size:11px}th{background:#f4f7fb}</style><h1>${html(activeAdminSurvey.survey_name)}</h1><p>عدد المشاركات: ${adminRows.length} | المتوسط العام: ${adminStats.overall.toFixed(2)} / 5</p><table><thead><tr><th>الرقم</th><th>الاسم</th><th>القسم</th><th>المتوسط</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table></html>`;
    try{const f=await Print.printToFileAsync({html:doc}); if(await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri,{mimeType:"application/pdf",dialogTitle:"تصدير تقرير PDF"}); else Alert.alert("تم إنشاء PDF",f.uri);}catch(e:any){Alert.alert("تعذر تصدير PDF",errText(e));}
  };

  const loadEmployees = async () => {
    if(!(systemAdmin || permissions.EMPLOYEES_VIEW))
      throw new Error("لا تملك صلاحية عرض ملفات الموظفين.");
    const {data,error}=await supabase
      .from("employees")
      .select("id,employee_number,employee_name,job_title,department_name,is_active")
      .order("employee_number",{ascending:true})
      .limit(1000);
    if(error) throw error;
    setEmployeesRows(data||[]);
    return data||[];
  };

  const openEmployeeManagement = async () => {
    if(!(systemAdmin || permissions.EMPLOYEES_VIEW)){
      Alert.alert("غير مصرح","لا تملك صلاحية عرض ملفات الموظفين.");
      return;
    }
    setBusy(true);
    try{
      await loadEmployees();
      setEmployeeSearch("");
      setSelectedEmployeeRecord(null);
      setScreen("employees");
    }catch(e:any){Alert.alert("تعذر تحميل الموظفين",errText(e));}
    finally{setBusy(false);}
  };

  const saveEmployeeRecord = async () => {
    if(!(systemAdmin || permissions.EMPLOYEES_UPDATE)){
      Alert.alert("غير مصرح","لا تملك صلاحية تعديل ملفات الموظفين.");
      return;
    }
    if(!selectedEmployeeRecord?.id){Alert.alert("اختر الموظف","حدد ملف الموظف المراد تعديله.");return;}
    setBusy(true);
    try{
      const {data:updatedRows,error}=await supabase.from("employees").update({
        job_title:editEmployeeJobTitle.trim()||null,
        department_name:editEmployeeDepartment.trim()||null,
        is_active:editEmployeeActive
      }).eq("id",selectedEmployeeRecord.id).select("id");
      if(error) throw error;
      if(!updatedRows?.length) throw new Error("لم يتم تعديل السجل. تحقق من صلاحية EMPLOYEES_UPDATE وسياسة RLS.");
      const refreshed=await loadEmployees();
      const updated=refreshed.find((r:any)=>r.id===selectedEmployeeRecord.id)||null;
      setSelectedEmployeeRecord(updated);
      Alert.alert("تم الحفظ","تم تحديث بيانات الموظف بنجاح.");
    }catch(e:any){Alert.alert("تعذر حفظ بيانات الموظف",errText(e));}
    finally{setBusy(false);}
  };

  const filteredEmployees=employeesRows.filter((r:any)=>{
    const q=employeeSearch.trim().toLowerCase();
    return !q || String(r.employee_number||"").toLowerCase().includes(q) ||
      String(r.employee_name||"").toLowerCase().includes(q) ||
      String(r.department_name||"").toLowerCase().includes(q) ||
      String(r.job_title||"").toLowerCase().includes(q);
  }).slice(0,100);
  const activeEmployeesCount=employeesRows.filter((r:any)=>r.is_active===true).length;
  const inactiveEmployeesCount=employeesRows.length-activeEmployeesCount;

  const loadWorkflowManagementData = async () => {
    if(!systemAdmin) throw new Error("هذه الشاشة متاحة لمدير النظام فقط.");
    const {data,error}=await supabase.rpc("get_workflow_management_data");
    if(error) throw error;
    const normalized=normalizeWorkflowData(data);
    if(!normalized.branches.length || !normalized.employees.length)
      throw new Error("تم الاتصال بدالة الإدارة، لكن بنية البيانات المستلمة غير مكتملة. يلزم مراجعة نتيجة الدالة قبل اعتماد الشاشة.");
    setWorkflowData(normalized);
    if(!workflowBranch && normalized.branches.length) setWorkflowBranch(branchCodeOf(normalized.branches[0]));
    return normalized;
  };

  const openWorkflowManagement = async () => {
    if(!systemAdmin){Alert.alert("غير مصرح","إدارة مسارات الموافقات متاحة لمدير النظام فقط.");return;}
    setBusy(true);
    try{await loadWorkflowManagementData();setWorkflowSearch("");setWorkflowSelectedEmployee(null);setScreen("workflow");}
    catch(e:any){Alert.alert("تعذر تحميل إدارة الموافقات",errText(e));}
    finally{setBusy(false);}
  };

  const saveEmployeeWorkflowAssignment = async () => {
    if(!workflowSelectedEmployee){Alert.alert("اختر الموظف","حدد الموظف المراد تعيين مدير مباشر له.");return;}
    if(!workflowBranch || !workflowManager){Alert.alert("بيانات ناقصة","حدد الفرع والمدير المباشر.");return;}
    setBusy(true);
    try{
      const {error}=await supabase.rpc("set_employee_workflow_assignment",{
        p_employee_number:employeeNoOf(workflowSelectedEmployee),p_branch_code:workflowBranch,p_manager_employee_number:workflowManager
      });
      if(error) throw error;
      await loadWorkflowManagementData();
      Alert.alert("تم الحفظ","تم تحديث الفرع والمدير المباشر للموظف.");
    }catch(e:any){Alert.alert("تعذر حفظ التعيين",errText(e));}
    finally{setBusy(false);}
  };

  const saveBulkEmployeeWorkflowAssignments = async () => {
    if(!workflowBulkManager || !workflowBranch || !workflowBulkEmployees.length){Alert.alert("بيانات ناقصة","اختر المدير والفرع وموظفاً واحداً على الأقل.");return;}
    setBusy(true);
    try{
      const {data,error}=await supabase.rpc("set_employee_workflow_assignments",{
        p_employee_numbers:workflowBulkEmployees,p_branch_code:workflowBranch,p_manager_employee_number:workflowBulkManager
      });
      if(error) throw error;
      await loadWorkflowManagementData();
      setWorkflowBulkEmployees([]);
      Alert.alert("تم الحفظ",`تم حفظ التعيينات الجماعية بنجاح. عدد الموظفين: ${Number(data?.count ?? workflowBulkEmployees.length)}.`);
    }catch(e:any){Alert.alert("تعذر حفظ التعيينات الجماعية",errText(e));}
    finally{setBusy(false);}
  };

  const changeManagerRole = async (person:any, enabled:boolean) => {
    const no=employeeNoOf(person); if(!no) return;
    setBusy(true);
    try{
      const {error}=await supabase.rpc("set_workflow_manager_role",{p_employee_number:no,p_is_manager:enabled});
      if(error) throw error;
      await loadWorkflowManagementData();
      Alert.alert("تم التحديث",enabled?"تمت إضافة صلاحية المدير المباشر.":"تمت إزالة صلاحية المدير المباشر.");
    }catch(e:any){Alert.alert("تعذر تحديث المديرين",errText(e));}
    finally{setBusy(false);}
  };

  const saveBranchApprover = async () => {
    if(!workflowBranch || !workflowApproverEmployee){Alert.alert("بيانات ناقصة","حدد الفرع والموظف.");return;}
    setBusy(true);
    try{
      const {error}=await supabase.rpc("set_workflow_branch_approver",{
        p_branch_code:workflowBranch,p_role_code:workflowApproverRole,p_employee_number:workflowApproverEmployee
      });
      if(error) throw error;
      await loadWorkflowManagementData();
      Alert.alert("تم الحفظ","تم تحديث مسؤول المرحلة للفرع المحدد.");
    }catch(e:any){Alert.alert("تعذر تعيين المسؤول",errText(e));}
    finally{setBusy(false);}
  };

  const filteredWorkflowEmployees=workflowData.employees.filter((r:any)=>{
    const q=workflowSearch.trim().toLowerCase();
    return !q || employeeNoOf(r).toLowerCase().includes(q) || employeeNameOf(r).toLowerCase().includes(q);
  });
  const pickerSource = workflowPicker === "manager" || workflowPicker === "bulkManager" ? workflowData.managers : workflowData.employees;
  const filteredPickerRows = pickerSource.filter((r:any)=>{
    const q=workflowPickerSearch.trim().toLowerCase();
    return !q || employeeNoOf(r).toLowerCase().includes(q) || employeeNameOf(r).toLowerCase().includes(q);
  });
  const openWorkflowPicker = (kind:NonNullable<typeof workflowPicker>) => { setWorkflowPickerSearch(""); setWorkflowPicker(kind); };
  const toggleBulkEmployee = (no:string) => setWorkflowBulkEmployees(prev=>prev.includes(no)?prev.filter(x=>x!==no):[...prev,no]);
  const managerNumbers=new Set(workflowData.managers.map((r:any)=>employeeNoOf(r)));

  const reset = () => {setScreen("home");setSelectedSurvey(null);setAnswers({});setReason("");setResult(null);};
  const logout = async () => {await supabase.auth.signOut();setEmployee(null);setEmployeeNo("");setPassword("");setCatalog([]);setSelectedSurvey(null);setAdminRows([]);setRoleCodes([]);setPermissions({});setSystemAdmin(false);setEmployeesRows([]);setSelectedEmployeeRecord(null);setScreen("login");};

  return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/>
    {screen==="login" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>نظام الموارد البشرية</Text><Text style={s.heroSub}>منصة موحدة لخدمات الموظفين والإدارة</Text></View>
      <View style={s.card}><Text style={s.title}>تسجيل الدخول الآمن</Text><Text style={s.sub}>استخدم رقمك الوظيفي وكلمة المرور التي يحددها مسؤول النظام. الرقم الوظيفي ليس كلمة المرور.</Text>
        <Field label="الرقم الوظيفي" value={employeeNo} onChangeText={setEmployeeNo} keyboardType="numeric" placeholder="أدخل الرقم الوظيفي"/>
        <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry placeholder="أدخل كلمة المرور"/>
        <Btn title={busy?"جاري التحقق...":"دخول إلى النظام"} disabled={busy} onPress={login}/>
        <Text style={s.sub}>إذا لم يكن لديك حساب، راجع مسؤول النظام لإنشاء الحساب وربطه بملفك الوظيفي.</Text>
      </View>
    </ScrollView>}

    {screen==="dashboard" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>مرحباً {employee?.employee_name}</Text><Text style={s.heroSub}>الرقم الوظيفي: {employee?.employee_number}</Text></View>
      <View style={s.card}><Text style={s.title}>خدمات النظام</Text><Text style={s.sub}>تظهر الوحدات وفق الصلاحيات الممنوحة لحسابك.</Text>
        {(systemAdmin||permissions.EMPLOYEES_VIEW)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>ملف الموظفين</Text><Text style={s.sub}>عرض ملفات الموظفين والبحث فيها وتحديث القسم والمسمى الوظيفي وحالة التفعيل للمخولين.</Text><Btn title="فتح إدارة الموظفين" onPress={openEmployeeManagement}/></View>}
        {(systemAdmin||permissions.SURVEYS_VIEW||permissions.SURVEYS_MANAGE)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>الاستبيانات</Text><Text style={s.sub}>استبيان رضا الموظفين وتقييم الخدمات، مع إدارة الفترات والنتائج للمخولين.</Text><Btn title="فتح وحدة الاستبيانات" onPress={async()=>{setBusy(true);try{await loadCatalog();setScreen(employee?.is_survey_admin?"admin":"home");if(employee?.is_survey_admin) await loadAdmin(adminSurveyId,employee?.employee_number);}catch(e:any){Alert.alert("تعذر تحميل الاستبيانات",errText(e));}finally{setBusy(false);}}}/></View>}
        {(systemAdmin||permissions.ASSETS_VIEW)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>الأصول والعهد</Text><Text style={s.status}>قاعدة البيانات مجهزة — واجهات التطبيق في مرحلة التجهيز</Text></View>}
        {(systemAdmin||permissions.GRIEVANCES_VIEW||permissions.GRIEVANCES_CREATE)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>الشكاوى والتظلمات والتحقيقات</Text><Text style={s.status}>قاعدة البيانات مجهزة — واجهات التطبيق في مرحلة التجهيز</Text></View>}
        {(systemAdmin||permissions.IDEAS_VIEW||permissions.IDEAS_CREATE)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>الأفكار والمقترحات</Text><Text style={s.status}>قاعدة البيانات مجهزة — واجهات التطبيق في مرحلة التجهيز</Text></View>}
        {(systemAdmin||permissions.SERVICES_VIEW||permissions.SERVICES_CREATE)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>الخدمات الإدارية والتصاريح</Text><Text style={s.status}>قاعدة البيانات مجهزة — واجهات التطبيق في مرحلة التجهيز</Text></View>}
        {(systemAdmin||permissions.REPORTS_VIEW)&&<View style={s.surveyCard}><Text style={s.surveyTitle}>التقارير ومؤشرات الأداء</Text><Text style={s.status}>قاعدة البيانات مجهزة — واجهات التطبيق في مرحلة التجهيز</Text></View>}
        {systemAdmin&&<View style={s.surveyCard}><Text style={s.surveyTitle}>إدارة مسارات الموافقات</Text><Text style={s.sub}>تعيين المدير المباشر لكل موظف، وإدارة المديرين، وتحديد مسؤولي الخدمات والمراجعة حسب الفرع.</Text><Btn title="فتح إدارة مسارات الموافقات" onPress={openWorkflowManagement}/></View>}
        <Btn title="تسجيل الخروج" secondary onPress={logout}/>
      </View>
    </ScrollView>}

    {screen==="home" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>مرحباً {employee?.employee_name}</Text><Text style={s.heroSub}>الرقم الوظيفي: {employee?.employee_number}</Text></View>
      <View style={s.card}><Text style={s.title}>الاستبيانات المتاحة</Text><Text style={s.sub}>اختر الاستبيان الذي ترغب في المشاركة فيه.</Text>
        {catalog.filter(x=>x.is_active).map(sv=><View key={sv.id} style={s.surveyCard}><Text style={s.surveyTitle}>{sv.survey_name}</Text><Text style={s.sub}>{sv.description||`${sv.questions?.length||0} سؤالاً`}</Text><Text style={s.status}>{dateOpen(sv.period)?"مفتوح للمشاركة":"مغلق حالياً"}</Text><Btn title="فتح الاستبيان" secondary={!dateOpen(sv.period)} onPress={()=>chooseSurvey(sv)}/></View>)}
        <Btn title="العودة إلى خدمات النظام" secondary onPress={()=>setScreen("dashboard")}/>
        <Btn title="تسجيل الخروج" secondary onPress={logout}/>
      </View>
    </ScrollView>}

    {screen==="employee" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.card}><Text style={s.title}>بيانات الموظف</Text><Text style={s.sub}>{selectedSurvey?.survey_name}</Text>
        <View style={s.readonly}><Text style={s.label}>اسم الموظف</Text><Text style={s.readonlyText}>{employee?.employee_name}</Text></View>
        <View style={s.readonly}><Text style={s.label}>الرقم الوظيفي</Text><Text style={s.readonlyText}>{employee?.employee_number}</Text></View>
        <Choices label="القسم" values={DEPARTMENTS} value={department} onChange={setDepartment}/>
        <Choices label="الدرجة الوظيفية" values={GRADES} value={grade} onChange={setGrade}/>
        <Field label="سنوات الخدمة" value={years} onChangeText={setYears} keyboardType="numeric" placeholder="من 1 إلى 30"/>
        <Choices label="المؤهل" values={QUALIFICATIONS} value={qualification} onChange={setQualification}/>
        <Btn title={busy?"جاري التحقق...":"متابعة إلى الأسئلة"} disabled={busy} onPress={startSurvey}/>
        <Btn title="رجوع" secondary onPress={()=>setScreen("home")}/>
      </View>
    </ScrollView>}

    {screen==="survey" && <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.card}><Text style={s.title}>{selectedSurvey?.survey_name}</Text><Text style={s.sub}>أجبت عن {Object.keys(answers).length} من {questions.length} — {progress}%</Text><View style={s.progress}><View style={[s.fill,{width:`${progress}%`}]}/></View></View>
        {Array.from(new Set<number>(questions.map(q=>q.domain_no))).sort((a,b)=>a-b).map(d=>{
          const group=questions.filter(q=>q.domain_no===d); const domainName=group[0]?.domain_name||`المجال ${d}`;
          return <View key={d}><Text style={s.domain}>{domainName}</Text>{group.map(q=><View key={q.question_no} style={s.qcard}>
            <Text style={s.qno}>السؤال {q.question_no}</Text><Text style={s.question}>{q.question_text}</Text>
            <View style={s.scale}>{(selectedSurvey?.id===2?SCALE_2:SCALE_1).map(x=><Pressable key={x[0]} onPress={()=>setAnswers(a=>({...a,[q.question_no]:x[0]}))} style={[s.scaleItem,answers[q.question_no]===x[0]&&s.active]}><Text style={[s.val,answers[q.question_no]===x[0]&&s.white]}>{x[0]}</Text><Text style={[s.lbl,answers[q.question_no]===x[0]&&s.white]}>{x[1]}</Text></Pressable>)}</View>
          </View>)}</View>;
        })}
        {selectedSurvey?.id===1 && <View style={s.qcard}><Text style={s.qno}>ملاحظة مفتوحة</Text><Text style={s.question}>الأسباب التي أثرت على معنوياتك.</Text><TextInput value={reason} onChangeText={setReason} multiline style={[s.input,{height:100,textAlignVertical:"top"}]} placeholder="اكتب الأسباب إن وجدت..."/></View>}
        <Btn title={busy?"جاري الحفظ...":"إرسال الاستبيان"} disabled={busy} onPress={submit}/><Btn title="رجوع" secondary onPress={()=>setScreen("employee")}/>
      </ScrollView>
    </KeyboardAvoidingView>}

    {screen==="result" && <ScrollView contentContainerStyle={s.container}><View style={s.card}><Text style={s.done}>✓</Text><Text style={s.title}>تم تسجيل الاستبيان بنجاح</Text><Text style={s.body}>تم حفظ إجاباتك وحساب متوسطات المجالات والنتيجة الإجمالية.</Text>{result&&<><Score title="المجال الأول" v={result.d1}/><Score title="المجال الثاني" v={result.d2}/><Score title="المجال الثالث" v={result.d3}/><Score title="النتيجة الإجمالية" v={result.total} total/></>}<Btn title="إنهاء" onPress={reset}/></View></ScrollView>}

    {screen==="admin" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>لوحة إدارة الاستبيانات</Text><Text style={s.heroSub}>{employee?.employee_name} — مدير النظام</Text></View>
      <View style={s.card}><Text style={s.title}>اختيار الاستبيان</Text><View style={s.chips}>{catalog.map(sv=><Pressable key={sv.id} onPress={()=>{setAdminSurveyId(sv.id);setPeriodStart(sv.period?.start_at||"");setPeriodEnd(sv.period?.end_at||"");setPeriodEnabled(!!sv.period?.is_enabled);loadAdmin(sv.id);}} style={[s.chip,adminSurveyId===sv.id&&s.chipActive]}><Text style={[s.chipText,adminSurveyId===sv.id&&s.white]}>{sv.survey_name}</Text></Pressable>)}</View>
        <Text style={s.sectionTitle}>مؤشرات المشاركة</Text><View style={s.metrics}><Metric title="عدد المشاركات" value={String(adminStats.count)}/><Metric title="المتوسط العام" value={`${adminStats.overall.toFixed(2)} / 5`}/></View>
        <Text style={s.sectionTitle}>الرسم البياني لمتوسطات المجالات</Text>
        <AverageBar title="المجال الأول" value={adminStats.d1}/><AverageBar title="المجال الثاني" value={adminStats.d2}/><AverageBar title="المجال الثالث" value={adminStats.d3}/><AverageBar title="المتوسط العام" value={adminStats.overall}/>
        <Text style={s.sub}>قراءة المؤشر: 4.50–5 ممتاز، 3.50–أقل من 4.50 جيد جداً، 2.50–أقل من 3.50 جيد، 1.50–أقل من 2.50 مقبول، وأقل من 1.50 ضعيف.</Text>
        <Btn title={busy?"جاري التحديث...":"تحديث النتائج"} secondary disabled={busy} onPress={()=>loadAdmin(adminSurveyId)}/>
      </View>
      <View style={s.card}><Text style={s.title}>إدارة فترة الاستبيان</Text><Text style={s.sub}>التواريخ بصيغة ISO 8601، مثال: 2026-11-07T08:00:00+03:00. اترك الحقل فارغاً لعدم وضع حد زمني.</Text>
        <Field label="بداية الاستبيان" value={periodStart} onChangeText={setPeriodStart} placeholder="2026-11-07T08:00:00+03:00"/>
        <Field label="نهاية الاستبيان" value={periodEnd} onChangeText={setPeriodEnd} placeholder="2026-11-15T23:59:00+03:00"/>
        <Pressable onPress={()=>setPeriodEnabled(v=>!v)} style={s.toggle}><Text style={s.label}>تفعيل استقبال المشاركات</Text><Text style={[s.toggleValue,periodEnabled&&{color:C.success}]}>{periodEnabled?"مفعّل":"مغلق"}  ◉</Text></Pressable>
        <Btn title="حفظ فترة الاستبيان" disabled={busy} onPress={updatePeriod}/>
      </View>
      <View style={s.card}><Text style={s.title}>الإجابات المسجلة</Text><Text style={s.sub}>اضغط على أي مشاركة لعرض إجاباتها التفصيلية.</Text>
        <View style={s.exportRow}><Pressable onPress={exportCsv} style={s.exportBtn}><Text style={s.exportText}>تصدير Excel (CSV)</Text></Pressable><Pressable onPress={exportPdf} style={s.exportBtn}><Text style={s.exportText}>تصدير PDF</Text></Pressable></View>
        {adminRows.map(r=><View key={r.id} style={s.responseCard}><Pressable onPress={()=>setSelectedResponse(selectedResponse===r.id?null:r.id)}><Text style={s.responseTitle}>{r.employee_name||"موظف"} — {r.employee_number}</Text><Text style={s.sub}>{r.department} | المتوسط: {Number(r.overall_average||0).toFixed(2)} / 5</Text><Text style={s.smallMuted}>{new Date(r.submitted_at).toLocaleString("ar")}</Text></Pressable>
          {selectedResponse===r.id && <View style={s.answerList}>{(r.answers||[]).map((a:any)=><View key={`${r.id}-${a.question_no}`} style={s.answerLine}><Text style={s.answerText}>{a.question_no}. {a.question_text||`السؤال ${a.question_no}`}</Text><Text style={s.answerValue}>{a.answer_value} / 5</Text></View>)}</View>}
        </View>)}
        {!adminRows.length&&<Text style={s.empty}>لا توجد مشاركات مسجلة لهذا الاستبيان حتى الآن.</Text>}
      </View>
      <Btn title="تسجيل الخروج" secondary onPress={logout}/>
    </ScrollView>}
    {screen==="employees" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>إدارة ملفات الموظفين</Text><Text style={s.heroSub}>عرض وبحث وتحديث بيانات الموظفين وفق الصلاحيات الممنوحة</Text></View>
      <View style={s.card}>
        <Text style={s.title}>ملخص السجل الوظيفي</Text>
        <View style={s.metrics}>
          <Metric title="إجمالي السجلات المحملة" value={String(employeesRows.length)}/>
          <Metric title="الموظفون النشطون" value={String(activeEmployeesCount)}/>
          <Metric title="غير النشطين" value={String(inactiveEmployeesCount)}/>
        </View>
        <Field label="البحث عن موظف" value={employeeSearch} onChangeText={setEmployeeSearch} placeholder="الاسم أو الرقم أو القسم أو المسمى"/>
        <Text style={s.sub}>يعرض التطبيق أول 100 نتيجة مطابقة. اضغط على الموظف لعرض بياناته.</Text>
        {filteredEmployees.map((r:any)=><Pressable key={String(r.id)} onPress={()=>{
          setSelectedEmployeeRecord(r);
          setEditEmployeeJobTitle(String(r.job_title||""));
          setEditEmployeeDepartment(String(r.department_name||""));
          setEditEmployeeActive(r.is_active===true);
        }} style={[s.responseCard,selectedEmployeeRecord?.id===r.id&&{borderColor:C.primary,backgroundColor:C.pale}]}>
          <Text style={s.responseTitle}>{r.employee_name||"بدون اسم"} — {r.employee_number}</Text>
          <Text style={s.smallMuted}>{r.department_name||"القسم غير محدد"} | {r.job_title||"المسمى غير محدد"}</Text>
          <Text style={[s.status,{color:r.is_active===true?C.success:C.primary}]}>{r.is_active===true?"نشط":"غير نشط"}</Text>
        </Pressable>)}
        {!filteredEmployees.length&&<Text style={s.empty}>لا توجد نتائج مطابقة للبحث.</Text>}
        <Btn title="تحديث قائمة الموظفين" secondary disabled={busy} onPress={async()=>{setBusy(true);try{await loadEmployees();}catch(e:any){Alert.alert("تعذر التحديث",errText(e));}finally{setBusy(false);}}}/>
      </View>
      {selectedEmployeeRecord&&<View style={s.card}>
        <Text style={s.title}>بيانات الموظف المحدد</Text>
        <View style={s.readonly}><Text style={s.label}>اسم الموظف</Text><Text style={s.readonlyText}>{selectedEmployeeRecord.employee_name||"—"}</Text></View>
        <View style={s.readonly}><Text style={s.label}>الرقم الوظيفي</Text><Text style={s.readonlyText}>{selectedEmployeeRecord.employee_number}</Text></View>
        {systemAdmin||permissions.EMPLOYEES_UPDATE ? <>
          <Field label="القسم" value={editEmployeeDepartment} onChangeText={setEditEmployeeDepartment} placeholder="اسم القسم"/>
          <Field label="المسمى الوظيفي" value={editEmployeeJobTitle} onChangeText={setEditEmployeeJobTitle} placeholder="المسمى الوظيفي"/>
          <Pressable onPress={()=>setEditEmployeeActive(v=>!v)} style={s.toggle}>
            <Text style={s.label}>حالة ملف الموظف</Text>
            <Text style={[s.toggleValue,{color:editEmployeeActive?C.success:C.primary}]}>{editEmployeeActive?"نشط — يسمح بتسجيل الدخول":"غير نشط — يمنع تسجيل الدخول"} ◉</Text>
          </Pressable>
          <Btn title="حفظ تعديلات الموظف" disabled={busy} onPress={saveEmployeeRecord}/>
        </> : <Text style={s.sub}>حسابك يملك صلاحية العرض فقط، ولا يملك صلاحية تعديل بيانات الموظفين.</Text>}
      </View>}
      <Btn title="العودة إلى خدمات النظام" secondary onPress={()=>setScreen("dashboard")}/>
    </ScrollView>}

    {screen==="workflow" && systemAdmin && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>إدارة مسارات الموافقات</Text><Text style={s.heroSub}>إعداد المدير المباشر ومسؤولي الخدمات والمراجعة حسب الفرع</Text></View>
      <View style={s.card}><Text style={s.title}>1. تعيين مدير مباشر لموظف</Text><Text style={s.sub}>جميع الموظفين النشطين متاحون في قائمة منسدلة قابلة للبحث، دون حد أقصى للنتائج. إجمالي الموظفين المحملين: {workflowData.employees.length}.</Text>
        <Btn title={workflowSelectedEmployee?`${employeeNameOf(workflowSelectedEmployee)} — ${employeeNoOf(workflowSelectedEmployee)}`:"اختر الموظف من القائمة"} secondary onPress={()=>openWorkflowPicker("employee")}/>
        {workflowSelectedEmployee&&<View style={s.selectedPanel}><Text style={s.label}>الموظف المحدد: {employeeNameOf(workflowSelectedEmployee)} ({employeeNoOf(workflowSelectedEmployee)})</Text>
          <Text style={s.label}>الفرع</Text><View style={s.chips}>{workflowData.branches.map((b:any)=><Pressable key={branchCodeOf(b)} onPress={()=>setWorkflowBranch(branchCodeOf(b))} style={[s.chip,workflowBranch===branchCodeOf(b)&&s.chipActive]}><Text style={[s.chipText,workflowBranch===branchCodeOf(b)&&s.white]}>{branchNameOf(b)}</Text></Pressable>)}</View>
          <Text style={s.label}>المدير المباشر</Text>
          <Btn title={workflowData.managers.find((m:any)=>employeeNoOf(m)===workflowManager)?`${employeeNameOf(workflowData.managers.find((m:any)=>employeeNoOf(m)===workflowManager))} — ${workflowManager}`:"اختر المدير المباشر"} secondary onPress={()=>openWorkflowPicker("manager")}/>
          <Btn title="حفظ تعيين الموظف" disabled={busy} onPress={saveEmployeeWorkflowAssignment}/>
        </View>}
      </View>
      <View style={s.card}><Text style={s.title}>2. تعيين عدة موظفين لمدير واحد</Text><Text style={s.sub}>اختر المدير أولاً، ثم حدد الموظفين المطلوب إلحاقهم به. يمكنك البحث أو تحديد جميع الموظفين.</Text>
        <Btn title={workflowBulkManager?`${employeeNameOf(workflowData.managers.find((m:any)=>employeeNoOf(m)===workflowBulkManager)||{})} — ${workflowBulkManager}`:"اختر المدير المباشر"} secondary onPress={()=>openWorkflowPicker("bulkManager")}/>
        <Text style={s.label}>الفرع</Text><View style={s.chips}>{workflowData.branches.map((b:any)=><Pressable key={branchCodeOf(b)} onPress={()=>setWorkflowBranch(branchCodeOf(b))} style={[s.chip,workflowBranch===branchCodeOf(b)&&s.chipActive]}><Text style={[s.chipText,workflowBranch===branchCodeOf(b)&&s.white]}>{branchNameOf(b)}</Text></Pressable>)}</View>
        <Btn title={`اختيار الموظفين (${workflowBulkEmployees.length} محدد)`} secondary onPress={()=>openWorkflowPicker("bulkEmployees")}/>
        <Btn title="حفظ تعيينات الموظفين المحددين" disabled={busy||!workflowBulkEmployees.length} onPress={saveBulkEmployeeWorkflowAssignments}/>
      </View>
      <View style={s.card}><Text style={s.title}>2. إدارة المديرين المباشرين</Text><Text style={s.sub}>اختر موظفاً من نتائج البحث أعلاه ثم أضف أو أزل عنه دور المدير المباشر. لا يمكن إزالة مدير لديه موظفون مرتبطون بتعيين نشط.</Text>
        {workflowSelectedEmployee&&<><Text style={s.body}>{employeeNameOf(workflowSelectedEmployee)} — {employeeNoOf(workflowSelectedEmployee)}</Text><Text style={s.status}>{managerNumbers.has(employeeNoOf(workflowSelectedEmployee))?"لديه حالياً دور مدير مباشر":"ليس لديه دور مدير مباشر"}</Text><Btn title={managerNumbers.has(employeeNoOf(workflowSelectedEmployee))?"إزالة دور المدير المباشر":"إضافة دور المدير المباشر"} secondary={!managerNumbers.has(employeeNoOf(workflowSelectedEmployee))} disabled={busy} onPress={()=>changeManagerRole(workflowSelectedEmployee,!managerNumbers.has(employeeNoOf(workflowSelectedEmployee)))}/></>}
        <Text style={s.sectionTitle}>المديرون المعتمدون حالياً</Text>
        {workflowData.managers.map((m:any)=><View key={employeeNoOf(m)} style={s.responseCard}><Text style={s.responseTitle}>{employeeNameOf(m)} — {employeeNoOf(m)}</Text></View>)}
      </View>
      <View style={s.card}><Text style={s.title}>3. مسؤولو الخدمات والمراجعة حسب الفرع</Text><Text style={s.sub}>تغيير مسؤول المرحلة لا يغيّر تسلسل الموافقات: المدير المباشر ← الخدمات الإدارية ← المراجعة.</Text>
        <Text style={s.label}>الفرع</Text><View style={s.chips}>{workflowData.branches.map((b:any)=><Pressable key={branchCodeOf(b)} onPress={()=>setWorkflowBranch(branchCodeOf(b))} style={[s.chip,workflowBranch===branchCodeOf(b)&&s.chipActive]}><Text style={[s.chipText,workflowBranch===branchCodeOf(b)&&s.white]}>{branchNameOf(b)}</Text></Pressable>)}</View>
        <Text style={s.label}>مرحلة الموافقة</Text><View style={s.chips}><Pressable onPress={()=>setWorkflowApproverRole("SERVICES_ADMIN")} style={[s.chip,workflowApproverRole==="SERVICES_ADMIN"&&s.chipActive]}><Text style={[s.chipText,workflowApproverRole==="SERVICES_ADMIN"&&s.white]}>الخدمات الإدارية</Text></Pressable><Pressable onPress={()=>setWorkflowApproverRole("REQUEST_AUDITOR")} style={[s.chip,workflowApproverRole==="REQUEST_AUDITOR"&&s.chipActive]}><Text style={[s.chipText,workflowApproverRole==="REQUEST_AUDITOR"&&s.white]}>المراجعة</Text></Pressable></View>
        <Text style={s.label}>الموظف المسؤول الجديد</Text><Field label="الرقم الوظيفي للمسؤول" value={workflowApproverEmployee} onChangeText={setWorkflowApproverEmployee} keyboardType="numeric" placeholder="أدخل الرقم الوظيفي"/>
        {workflowSelectedEmployee&&<Btn title={`استخدام الموظف المحدد: ${employeeNameOf(workflowSelectedEmployee)}`} secondary onPress={()=>setWorkflowApproverEmployee(employeeNoOf(workflowSelectedEmployee))}/>}
        <Btn title="حفظ مسؤول المرحلة" disabled={busy} onPress={saveBranchApprover}/>
        <Text style={s.sectionTitle}>التعيينات الحالية</Text>
        {workflowData.branch_approvers.map((a:any,i:number)=><View key={String(pick(a,["id"],i))} style={s.responseCard}><Text style={s.responseTitle}>{String(pick(a,["branch_name","branch_code"],"فرع"))} — {pick(a,["role_code"],"")==="SERVICES_ADMIN"?"الخدمات الإدارية":"المراجعة"}</Text><Text style={s.smallMuted}>{employeeNameOf(a)} — {employeeNoOf(a)}</Text></View>)}
      </View>
      <Btn title="تحديث البيانات" secondary disabled={busy} onPress={async()=>{setBusy(true);try{await loadWorkflowManagementData();}catch(e:any){Alert.alert("تعذر التحديث",errText(e));}finally{setBusy(false);}}}/>
      <Btn title="العودة إلى خدمات النظام" secondary onPress={()=>setScreen("dashboard")}/>
    </ScrollView>}
    <Modal visible={workflowPicker!==null} transparent animationType="slide" onRequestClose={()=>setWorkflowPicker(null)}>
      <View style={s.modalBackdrop}><View style={s.modalCard}>
        <Text style={s.title}>{workflowPicker==="employee"?"اختيار الموظف":workflowPicker==="manager"||workflowPicker==="bulkManager"?"اختيار المدير المباشر":"اختيار الموظفين"}</Text>
        <TextInput value={workflowPickerSearch} onChangeText={setWorkflowPickerSearch} style={s.input} placeholder="ابحث بالاسم أو الرقم الوظيفي" placeholderTextColor="#9AA3AD" textAlign="right" autoFocus/>
        {workflowPicker==="bulkEmployees"&&<View style={s.modalActions}>
          <Pressable onPress={()=>setWorkflowBulkEmployees(workflowData.employees.map((r:any)=>employeeNoOf(r)).filter(Boolean))} style={s.modalAction}><Text style={s.chipText}>تحديد الكل ({workflowData.employees.length})</Text></Pressable>
          <Pressable onPress={()=>setWorkflowBulkEmployees([])} style={s.modalAction}><Text style={s.chipText}>إلغاء التحديد</Text></Pressable>
        </View>}
        <ScrollView style={s.modalList} keyboardShouldPersistTaps="handled">
          {filteredPickerRows.map((r:any)=>{const no=employeeNoOf(r);const selected=workflowPicker==="bulkEmployees"?workflowBulkEmployees.includes(no):workflowPicker==="employee"?employeeNoOf(workflowSelectedEmployee)===no:workflowPicker==="manager"?workflowManager===no:workflowBulkManager===no;return <Pressable key={no} onPress={()=>{if(workflowPicker==="employee"){setWorkflowSelectedEmployee(r);setWorkflowManager(String(pick(r,["manager_employee_number","manager_number"],"")));const bc=String(pick(r,["branch_code"],""));if(bc)setWorkflowBranch(bc);setWorkflowPicker(null);}else if(workflowPicker==="manager"){setWorkflowManager(no);setWorkflowPicker(null);}else if(workflowPicker==="bulkManager"){setWorkflowBulkManager(no);setWorkflowPicker(null);}else{toggleBulkEmployee(no);}}} style={[s.pickerRow,selected&&s.pickerRowSelected]}><Text style={[s.pickerCheck,selected&&{color:C.primary}]}>{selected?"☑":"□"}</Text><View style={{flex:1}}><Text style={s.responseTitle}>{employeeNameOf(r)} — {no}</Text><Text style={s.smallMuted}>{String(pick(r,["branch_name"],""))}</Text></View></Pressable>;})}
          {!filteredPickerRows.length&&<Text style={s.empty}>لا توجد نتائج مطابقة.</Text>}
        </ScrollView>
        <Text style={s.sub}>عدد النتائج: {filteredPickerRows.length} من {pickerSource.length}{workflowPicker==="bulkEmployees"?` | المحدد: ${workflowBulkEmployees.length}`:""}</Text>
        {workflowPicker==="bulkEmployees"&&<Btn title="اعتماد اختيار الموظفين" onPress={()=>setWorkflowPicker(null)}/>}
        <Btn title="إغلاق" secondary onPress={()=>setWorkflowPicker(null)}/>
      </View></View>
    </Modal>
    {busy && <View pointerEvents="none" style={s.loading}><ActivityIndicator color={C.primary}/></View>}
  </SafeAreaView>;
}

function html(v:any){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] as string));}
function Field(p:any){return <View style={s.field}><Text style={s.label}>{p.label}</Text><TextInput {...p} style={s.input} placeholderTextColor="#9AA3AD" textAlign="right" autoCapitalize="none"/></View>;}
function Choices({label,values,value,onChange}:{label:string;values:string[];value:string;onChange:(v:string)=>void}){return <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.chips}>{values.map(v=><Pressable key={v} onPress={()=>onChange(v)} style={[s.chip,value===v&&s.chipActive]}><Text style={[s.chipText,value===v&&s.white]}>{v}</Text></Pressable>)}</View></View>;}
function Btn({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){return <Pressable onPress={onPress} disabled={disabled} style={[s.btn,secondary&&s.btn2,disabled&&{opacity:.5}]}><Text style={[s.btnText,secondary&&s.btnText2]}>{title}</Text></Pressable>;}
function Score({title,v,total=false}:{title:string;v:number;total?:boolean}){return <View style={[s.score,total&&s.total]}><Text style={s.scoreTitle}>{title}</Text><Text style={s.scoreVal}>{Number(v||0).toFixed(2)} / 5</Text></View>;}
function Metric({title,value}:{title:string;value:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricTitle}>{title}</Text></View>;}
function AverageBar({title,value}:{title:string;value:number}){const v=Math.max(0,Math.min(5,Number(value)||0));return <View style={s.barWrap}><View style={s.barHead}><Text style={s.barTitle}>{title}</Text><Text style={s.barValue}>{v.toFixed(2)} / 5</Text></View><View style={s.barTrack}><View style={[s.barFill,{width:`${v*20}%`}]}/></View></View>;}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},container:{padding:16,paddingBottom:40},hero:{backgroundColor:C.primary,borderRadius:18,padding:22,marginBottom:16},heroTitle:{color:"#fff",fontSize:24,fontWeight:"800",textAlign:"right"},heroSub:{color:"#fff",fontSize:13,textAlign:"right",marginTop:8,lineHeight:21},
 card:{backgroundColor:"#fff",borderRadius:16,padding:17,marginBottom:15,borderWidth:1,borderColor:"#E7EAF0"},title:{fontSize:21,fontWeight:"800",color:C.text,textAlign:"right"},sub:{fontSize:12,color:C.muted,textAlign:"right",marginTop:5,marginBottom:12,lineHeight:20},body:{fontSize:15,color:C.text,textAlign:"right",lineHeight:25,marginVertical:12},field:{marginBottom:14},label:{fontSize:13,fontWeight:"700",color:C.text,textAlign:"right",marginBottom:7},input:{borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:"#fff",padding:11,fontSize:14,color:C.text,minHeight:44},readonly:{marginBottom:13,alignItems:"flex-end"},readonlyText:{fontSize:15,color:C.dark,fontWeight:"700"},chips:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:7},chip:{borderWidth:1,borderColor:C.border,borderRadius:9,padding:9,backgroundColor:"#fff"},chipActive:{backgroundColor:C.primary,borderColor:C.primary},chipText:{fontSize:12,color:C.text},white:{color:"#fff"},btn:{backgroundColor:C.primary,borderRadius:10,paddingVertical:13,alignItems:"center",marginTop:8},btnText:{color:"#fff",fontWeight:"800",fontSize:14},btn2:{backgroundColor:"#fff",borderWidth:1,borderColor:C.border},btnText2:{color:C.dark},surveyCard:{borderWidth:1,borderColor:C.border,borderRadius:12,padding:13,marginTop:12},surveyTitle:{fontSize:16,fontWeight:"800",color:C.dark,textAlign:"right"},status:{fontSize:12,color:C.muted,textAlign:"right"},progress:{height:8,backgroundColor:"#E4E8ED",borderRadius:8,overflow:"hidden",marginTop:8},fill:{height:"100%",backgroundColor:C.primary},domain:{fontSize:17,fontWeight:"800",color:C.dark,textAlign:"right",marginVertical:10},qcard:{backgroundColor:"#fff",borderRadius:13,padding:14,marginBottom:11,borderWidth:1,borderColor:"#E7EAF0"},qno:{fontSize:12,fontWeight:"800",color:C.primary,textAlign:"right",marginBottom:6},question:{fontSize:14,fontWeight:"700",color:C.text,textAlign:"right",lineHeight:23,marginBottom:11},scale:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:6},scaleItem:{width:57,minHeight:60,borderWidth:1,borderColor:C.border,borderRadius:8,padding:5,alignItems:"center",justifyContent:"center"},active:{backgroundColor:C.primary,borderColor:C.primary},val:{fontSize:16,fontWeight:"800",color:C.dark},lbl:{fontSize:9,color:C.muted,textAlign:"center",marginTop:3},done:{alignSelf:"center",width:62,height:62,borderRadius:31,backgroundColor:"#E8F6EE",color:C.success,fontSize:42,fontWeight:"800",textAlign:"center",lineHeight:60,marginBottom:12},score:{flexDirection:"row-reverse",justifyContent:"space-between",padding:12,borderBottomWidth:1,borderBottomColor:"#EDF0F3"},scoreTitle:{color:C.text,fontSize:13},scoreVal:{fontWeight:"800",color:C.dark},total:{backgroundColor:C.pale,borderBottomWidth:0,marginTop:5,borderRadius:8},sectionTitle:{fontSize:16,fontWeight:"800",color:C.dark,textAlign:"right",marginTop:20,marginBottom:10},barWrap:{marginBottom:12},barHead:{flexDirection:"row-reverse",justifyContent:"space-between",marginBottom:5},barTitle:{fontSize:12,color:C.text,fontWeight:"700"},barValue:{fontSize:12,color:C.dark,fontWeight:"800"},barTrack:{height:10,backgroundColor:"#E8EBEF",borderRadius:8,overflow:"hidden"},barFill:{height:"100%",backgroundColor:C.primary,borderRadius:8},metrics:{flexDirection:"row",gap:10},metric:{flex:1,backgroundColor:C.pale,padding:13,borderRadius:10,alignItems:"center",marginBottom:10},metricValue:{fontSize:21,fontWeight:"800",color:C.dark},metricTitle:{fontSize:11,color:C.muted,marginTop:5},toggle:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",padding:12,backgroundColor:C.bg,borderRadius:9},toggleValue:{fontWeight:"800",color:C.dark},exportRow:{flexDirection:"row-reverse",gap:8,marginBottom:12},exportBtn:{flex:1,padding:12,backgroundColor:C.pale,borderRadius:9,alignItems:"center"},exportText:{fontSize:12,fontWeight:"800",color:C.dark},responseCard:{borderWidth:1,borderColor:C.border,borderRadius:10,padding:12,marginTop:9},responseTitle:{fontWeight:"800",color:C.dark,textAlign:"right"},smallMuted:{fontSize:10,color:C.muted,textAlign:"right"},answerList:{borderTopWidth:1,borderTopColor:C.border,marginTop:10,paddingTop:7},answerLine:{paddingVertical:7,borderBottomWidth:1,borderBottomColor:"#F0F1F3"},answerText:{fontSize:12,color:C.text,textAlign:"right",lineHeight:19},answerValue:{fontSize:12,color:C.dark,fontWeight:"800",textAlign:"left",marginTop:3},empty:{textAlign:"center",color:C.muted,padding:15},selectedPanel:{marginTop:14,padding:12,borderRadius:10,backgroundColor:C.bg},modalBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,0.45)",justifyContent:"center",padding:14},modalCard:{backgroundColor:"#fff",borderRadius:16,padding:16,maxHeight:"88%"},modalList:{maxHeight:420,marginTop:10},modalActions:{flexDirection:"row-reverse",justifyContent:"space-between",marginTop:10},modalAction:{padding:9,borderWidth:1,borderColor:C.border,borderRadius:8},pickerRow:{flexDirection:"row-reverse",alignItems:"center",gap:10,padding:12,borderBottomWidth:1,borderBottomColor:"#EDF0F3"},pickerRowSelected:{backgroundColor:C.pale},pickerCheck:{fontSize:22,color:C.muted},loading:{position:"absolute",top:8,right:8,backgroundColor:"#fff",padding:7,borderRadius:20}
});
