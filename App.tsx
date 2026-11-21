import "react-native-url-polyfill/auto";
import React, { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View, ActivityIndicator
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
const SCALE_LOYALTY: [number,string][] = [[5,"أوافق بشدة"],[4,"أوافق"],[3,"محايد"],[2,"لا أوافق"],[1,"لا أوافق بشدة"]];

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
  const [screen,setScreen] = useState<"login"|"dashboard"|"home"|"employee"|"survey"|"result"|"admin"|"workflow"|"employees"|"module"|"surveyHub"|"settings"|"notifications">("login");
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
  const [workflowEmployeePickerOpen,setWorkflowEmployeePickerOpen] = useState(false);
  const [workflowBulkManager,setWorkflowBulkManager] = useState("");
  const [workflowBulkManagerSearch,setWorkflowBulkManagerSearch] = useState("");
  const [workflowBulkManagerPickerOpen,setWorkflowBulkManagerPickerOpen] = useState(false);
  const [workflowBulkEmployeeSearch,setWorkflowBulkEmployeeSearch] = useState("");
  const [workflowBulkSelectedEmployees,setWorkflowBulkSelectedEmployees] = useState<string[]>([]);
  const [workflowBranch,setWorkflowBranch] = useState("NAQIL");
  const [workflowManager,setWorkflowManager] = useState("");
  const [workflowApproverRole,setWorkflowApproverRole] = useState<"SERVICES_ADMIN"|"REQUEST_AUDITOR">("SERVICES_ADMIN");
  const [workflowApproverEmployee,setWorkflowApproverEmployee] = useState("");
  const [employeesRows,setEmployeesRows] = useState<any[]>([]);
  const [employeeSearch,setEmployeeSearch] = useState("");
  const [selectedEmployeeRecord,setSelectedEmployeeRecord] = useState<any>(null);
  const [editEmployeeJobTitle,setEditEmployeeJobTitle] = useState("");
  const [editEmployeeActive,setEditEmployeeActive] = useState(true);
  const [activeModule,setActiveModule] = useState<"assets"|"grievances"|"suggestions"|"services"|"reports">("assets");
  const [moduleTab,setModuleTab] = useState<"mine"|"manage">("mine");
  const [surveyTab,setSurveyTab] = useState<"mine"|"manage">("mine");
  const [pendingCounts,setPendingCounts] = useState<Record<string,number>>({surveys:0,grievances:0,suggestions:0,services:0,assets:0});
  const [moduleRows,setModuleRows] = useState<any[]>([]);
  const [moduleLookups,setModuleLookups] = useState<any[]>([]);
  const [moduleSearch,setModuleSearch] = useState("");
  const [moduleShowForm,setModuleShowForm] = useState(false);
  const [moduleSelected,setModuleSelected] = useState<any>(null);
  const [moduleTitle,setModuleTitle] = useState("");
  const [moduleDescription,setModuleDescription] = useState("");
  const [moduleType,setModuleType] = useState("");
  const [moduleCategory,setModuleCategory] = useState("");
  const [modulePriority,setModulePriority] = useState("NORMAL");
  const [moduleExtra,setModuleExtra] = useState("");
  const [reportRows,setReportRows] = useState<Record<string,any[]>>({});
  const [moduleAction,setModuleAction] = useState("");
  const [moduleEmployeeNo,setModuleEmployeeNo] = useState("");
  const [moduleCondition,setModuleCondition] = useState("good");
  const [moduleNotes,setModuleNotes] = useState("");
  const [moduleCost,setModuleCost] = useState("");
  const [moduleRelatedRows,setModuleRelatedRows] = useState<any[]>([]);
  const [moduleConfidentiality,setModuleConfidentiality] = useState("normal");
  const [moduleAnonymous,setModuleAnonymous] = useState(false);
  const [moduleBranch,setModuleBranch] = useState("ADMINISTRATION");
  const [moduleRequiredDate,setModuleRequiredDate] = useState("");
  const [moduleActionRequested,setModuleActionRequested] = useState("");
  const [investigationFindings,setInvestigationFindings] = useState("");
  const [investigationRecommendations,setInvestigationRecommendations] = useState("");
  const [investigationConclusion,setInvestigationConclusion] = useState("");

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
    // Extract the employee number from the login email: emp-<number>@hr.company.invalid
    const email = String(authUser.email || "").trim().toLowerCase();
    const emailMatch = email.match(/^emp-(.+)@hr\.company\.invalid$/);
    const loginEmployeeNumber = emailMatch?.[1]?.trim() || "";

    // Some legacy/admin accounts (including 100766) may have a valid Auth user
    // and employee record while their user_profiles row is missing or stale.
    // Do not reject the login before trying the employee-number fallback.
    if(profileError && !loginEmployeeNumber) throw profileError;

    let empRow:any = null;

    // First try the employee UUID linked to the user profile.
    if(profile?.employee_id){
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

    // Final fallback: locate the employee directly by the employee number.
    if(!empRow && loginEmployeeNumber){
      const {data,error} = await supabase
        .from("employees")
        .select("id,employee_number,employee_name,is_active,employment_status")
        .eq("employee_number",loginEmployeeNumber)
        .eq("is_active",true)
        .maybeSingle();
      if(error) throw error;
      empRow = data;
    }

    if(!empRow)
      throw new Error("لم يتم العثور على سجل الموظف المرتبط بالحساب. تحقق من وجود الرقم الوظيفي وتفعيل الموظف.");

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

    const permissionCodes=["SURVEYS_VIEW","SURVEYS_MANAGE","ASSETS_VIEW","ASSETS_CREATE","ASSETS_UPDATE","ASSETS_ASSIGN","ASSETS_MAINTAIN","ASSETS_MOVE","ASSETS_DISPOSE","GRIEVANCES_VIEW","GRIEVANCES_CREATE","GRIEVANCES_MANAGE","GRIEVANCES_INVESTIGATE","GRIEVANCES_DECIDE","IDEAS_VIEW","IDEAS_CREATE","IDEAS_REVIEW","IDEAS_IMPLEMENT","SERVICES_VIEW","SERVICES_CREATE","SERVICES_MANAGE","REPORTS_VIEW","EMPLOYEES_VIEW","EMPLOYEES_UPDATE","USERS_MANAGE","SETTINGS_MANAGE"];
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
      employee_name:profile?.display_name||empRow.employee_name,
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
      // الحسابات التي أنشأها نظام تهيئة المستخدمين تستخدم الرقم الوظيفي
      // كبريد داخلي وكلمة مرور أولية. نستخدم كلمة المرور المدخلة أولاً،
      // ثم نجرب الرقم الوظيفي ككلمة مرور أولية إذا رفضها Auth.
      let authResult = await supabase.auth.signInWithPassword({email,password});

      if(authResult.error && password !== no && /invalid login credentials/i.test(authResult.error.message || "")){
        authResult = await supabase.auth.signInWithPassword({email,password:no});
      }

      if(authResult.error) throw authResult.error;
      if(!authResult.data.user) throw new Error("تعذر التحقق من حساب المستخدم.");
      await loadAuthenticatedContext(authResult.data.user);
    }catch(e:any){
      await supabase.auth.signOut();
      const msg = /invalid login credentials/i.test(e?.message || "")
        ? "بيانات الدخول غير صحيحة. تحقق من الرقم الوظيفي وكلمة المرور. إذا كان الحساب جديداً، فجرّب الرقم الوظيفي ككلمة المرور الأولية."
        : errText(e);
      Alert.alert("تعذر تسجيل الدخول",msg);
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
      } else if(selectedSurvey.id===3){
        const r=await supabase.rpc("submit_survey_3_response",{
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
      .select("id,employee_number,employee_name,job_title,is_active")
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
    if(!systemAdmin){Alert.alert("غير مصرح","مسارات الموافقات متاحة لمدير النظام فقط.");return;}
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

  const saveBulkWorkflowAssignments = async () => {
    const numbers=Array.from(new Set(workflowBulkSelectedEmployees.map(x=>String(x).trim()).filter(Boolean)));
    if(!workflowBulkManager){Alert.alert("اختر المدير","حدد المدير المباشر أولاً.");return;}
    if(!workflowBranch){Alert.alert("حدد الفرع","اختر الفرع الذي ستسند إليه المجموعة.");return;}
    if(!numbers.length){Alert.alert("حدد الموظفين","اختر موظفاً واحداً على الأقل.");return;}
    Alert.alert("تأكيد التعيين الجماعي",`سيتم إسناد ${numbers.length} موظفاً إلى المدير المحدد. هل تريد المتابعة؟`,[
      {text:"إلغاء",style:"cancel"},
      {text:"تأكيد",onPress:async()=>{
        setBusy(true);
        try{
          const {data,error}=await supabase.rpc("set_employee_workflow_assignments",{
            p_employee_numbers:numbers,p_branch_code:workflowBranch,p_manager_employee_number:workflowBulkManager
          });
          if(error) throw error;
          setWorkflowBulkSelectedEmployees([]);
          await loadWorkflowManagementData();
          Alert.alert("تم التعيين",`تم حفظ تعيين ${Number(data?.count)||numbers.length} موظفاً للمدير المحدد.`);
        }catch(e:any){Alert.alert("تعذر التعيين الجماعي",errText(e));}
        finally{setBusy(false);}
      }}
    ]);
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

  const moduleTabCanReview=(key:string)=>{if(systemAdmin)return true;if(key==="grievances")return !!(permissions.GRIEVANCES_MANAGE||permissions.GRIEVANCES_INVESTIGATE||permissions.GRIEVANCES_DECIDE);if(key==="suggestions")return !!(permissions.IDEAS_REVIEW||permissions.IDEAS_IMPLEMENT);if(key==="services")return !!permissions.SERVICES_MANAGE;if(key==="assets")return !!(permissions.ASSETS_UPDATE||permissions.ASSETS_ASSIGN||permissions.ASSETS_MAINTAIN||permissions.ASSETS_MOVE||permissions.ASSETS_DISPOSE);return false;};
  const loadPendingCounts=async()=>{const next={surveys:0,grievances:0,suggestions:0,services:0,assets:0};try{if(systemAdmin||permissions.SURVEYS_MANAGE){const r=await supabase.from("survey_control").select("survey_id").eq("is_enabled",true);next.surveys=r.error?0:(r.data?.length||0);}if(systemAdmin||moduleTabCanReview("grievances")){const r=await supabase.from("grievances").select("id",{count:"exact",head:true}).in("status",["SUBMITTED","UNDER_REVIEW","INVESTIGATION"]);next.grievances=r.error?0:(r.count||0);}if(systemAdmin||moduleTabCanReview("suggestions")){const r=await supabase.from("suggestions").select("id",{count:"exact",head:true}).in("status",["SUBMITTED","UNDER_REVIEW","REFERRED","APPROVED","IN_PROGRESS"]);next.suggestions=r.error?0:(r.count||0);}if(systemAdmin||moduleTabCanReview("services")){const r=await supabase.rpc("get_admin_service_requests_for_user");const rows=Array.isArray(r.data)?r.data:[];next.services=r.error?0:rows.filter((x:any)=>["SUBMITTED","MANAGER_APPROVED","SERVICES_PENDING","REVIEW_PENDING","IN_PROGRESS"].includes(String(x.status||"").toUpperCase())).length;}}catch(_e){}setPendingCounts(next);};
  useEffect(()=>{if(employee)loadPendingCounts();},[employee,systemAdmin,permissions]);

  const moduleConfig:any={
    assets:{title:"الأصول والعهد",table:"assets",lookup:"asset_categories",view:"ASSETS_VIEW",access:["ASSETS_VIEW","ASSETS_CREATE","ASSETS_UPDATE","ASSETS_ASSIGN","ASSETS_MAINTAIN","ASSETS_MOVE","ASSETS_DISPOSE"],create:"ASSETS_CREATE",label:"الأصل",name:"asset_name"},
    grievances:{title:"الشكاوى والتظلمات",table:"grievances",lookup:"grievance_categories",view:"GRIEVANCES_VIEW",access:["GRIEVANCES_VIEW","GRIEVANCES_CREATE","GRIEVANCES_MANAGE","GRIEVANCES_INVESTIGATE","GRIEVANCES_DECIDE"],create:"GRIEVANCES_CREATE",label:"الشكوى",name:"subject"},
    suggestions:{title:"المقترحات",table:"suggestions",lookup:"suggestion_categories",view:"IDEAS_VIEW",access:["IDEAS_VIEW","IDEAS_CREATE","IDEAS_REVIEW","IDEAS_IMPLEMENT"],create:"IDEAS_CREATE",label:"المقترح",name:"title"},
    services:{title:"الخدمات الإدارية",table:"admin_service_requests",lookup:"admin_service_types",view:"SERVICES_VIEW",access:["SERVICES_VIEW","SERVICES_CREATE","SERVICES_MANAGE"],create:"SERVICES_CREATE",label:"الطلب",name:"title"}
  };

  const loadModuleData=async(key:"assets"|"grievances"|"suggestions"|"services")=>{
    const cfg=moduleConfig[key];
    let rows:any[]=[];
    if(key==="assets"){
      if(systemAdmin || permissions.ASSETS_VIEW){
        const q=await supabase.from("assets").select("*").order("created_at",{ascending:false}).limit(250);
        if(q.error) throw q.error; rows=q.data||[];
      }
      if(!systemAdmin && employee?.employee_number){
        const ae=await supabase.from("asset_assignments").select("*").eq("assignment_status","active").eq("employee_id",(employee as any).id||"").order("assigned_at",{ascending:false});
        if(!ae.error && ae.data?.length){
          const ids=ae.data.map((x:any)=>x.asset_id).filter(Boolean);
          if(ids.length){
            const ar=await supabase.from("assets").select("*").in("id",ids);
            if(!ar.error) rows=(ar.data||[]).map((a:any)=>({...a,_assignment:ae.data.find((x:any)=>String(x.asset_id)===String(a.id))}));
          }
        }
      }
    }else{
      let q:any;
      if(key==="services") q=await supabase.rpc("get_admin_service_requests_for_user");
      else q=await supabase.from(cfg.table).select("*").order("created_at",{ascending:false}).limit(250);
      if(q.error) throw q.error; rows=Array.isArray(q.data)?q.data:[];
    }
    const l=await supabase.from(cfg.lookup).select("*").limit(200);
    if(l.error && l.error.code!=="42P01") throw l.error;
    setModuleRows(rows);setModuleLookups(l.data||[]);
  };

  const openModule=async(key:"assets"|"grievances"|"suggestions"|"services"|"reports")=>{
    const allowed=systemAdmin || (key==="reports"?permissions.REPORTS_VIEW:moduleConfig[key].access.some((code:string)=>permissions[code]));
    if(!allowed){Alert.alert("غير مصرح","لا تملك صلاحية فتح هذه الوحدة.");return;}
    setActiveModule(key);setModuleSearch("");setModuleSelected(null);setModuleShowForm(false);setModuleRelatedRows([]);setModuleTab("mine");setBusy(true);
    try{
      if(key==="reports"){
        const views=["v_hr_dashboard_summary","v_hr_pending_approval_dashboard","v_admin_service_kpi","v_suggestions_kpi","v_grievances_kpi","v_grievance_investigation_kpi","v_admin_service_status","v_suggestions_status","v_grievances_status"];
        const entries=await Promise.all(views.map(async v=>{const {data,error}=await supabase.from(v).select("*").limit(100);if(error) return [v,[]] as [string,any[]];return [v,data||[]] as [string,any[]];}));
        setReportRows(Object.fromEntries(entries));
      }else await loadModuleData(key);
      setScreen("module");await loadPendingCounts();
    }catch(e:any){Alert.alert("تعذر فتح الوحدة",errText(e));}
    finally{setBusy(false);}
  };

  const resetModuleForm=()=>{
    setModuleTitle("");setModuleDescription("");setModuleType("");setModuleCategory("");setModulePriority("NORMAL");setModuleExtra("");
    setModuleConfidentiality("normal");setModuleAnonymous(false);setModuleBranch("ADMINISTRATION");setModuleRequiredDate("");setModuleActionRequested("");
    setModuleSelected(null);setModuleShowForm(false);
  };

  const resolveServiceWorkflow=async()=>{
    let branch=moduleBranch||"ADMINISTRATION", manager="", servicesApprover="", reviewApprover="";
    try{
      const ew=await supabase.from("employee_workflow_assignments").select("*").eq("employee_number",employee?.employee_number||"").maybeSingle();
      if(!ew.error && ew.data){
        branch=String(pick(ew.data,["branch_code","branch"],branch));
        manager=String(pick(ew.data,["manager_employee_number","manager_number"],""));
      }
    }catch(_e){}
    try{
      const ba=await supabase.from("workflow_branch_approvers").select("*").eq("branch_code",branch).eq("is_active",true);
      if(!ba.error){
        for(const a of ba.data||[]){
          const role=String(pick(a,["role_code","approver_role"],""));
          const no=String(pick(a,["employee_number","approver_employee_number","user_employee_number"],""));
          if(role==="SERVICES_ADMIN") servicesApprover=no;
          if(role==="REQUEST_AUDITOR") reviewApprover=no;
        }
      }
    }catch(_e){}
    if(!servicesApprover || !reviewApprover){
      const local=workflowData.branch_approvers||[];
      for(const a of local){
        if(String(pick(a,["branch_code"],""))!==branch) continue;
        const role=String(pick(a,["role_code"],"")); const no=employeeNoOf(a);
        if(role==="SERVICES_ADMIN") servicesApprover=no;
        if(role==="REQUEST_AUDITOR") reviewApprover=no;
      }
    }
    return {branch,manager,servicesApprover,reviewApprover};
  };

  const saveModuleRecord=async()=>{
    if(!moduleTitle.trim() && activeModule!=="assets"){Alert.alert("بيانات ناقصة","أدخل العنوان.");return;}
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){Alert.alert("انتهت الجلسة","سجل الدخول مرة أخرى.");return;}
    setBusy(true);
    try{
      if(activeModule==="assets"){
        if(!moduleCategory) throw new Error("اختر تصنيف الأصل.");
        if(!moduleExtra.trim()) throw new Error("أدخل رمز الأصل.");
        const r=await supabase.rpc("create_asset",{p_asset_code:moduleExtra.trim(),p_asset_name:moduleTitle.trim(),p_category_id:moduleCategory,p_asset_tag:null,p_description:moduleDescription.trim()||null,p_serial_number:null,p_manufacturer:null,p_model:null,p_purchase_date:null,p_purchase_cost:null,p_supplier_name:null,p_warranty_start_date:null,p_warranty_end_date:null,p_current_location_id:null,p_condition_status:"good",p_notes:null});
        if(r.error) throw r.error;
        Alert.alert("تم الحفظ","تم تسجيل الأصل بنجاح.");
      }else if(activeModule==="grievances"){
        if(!moduleCategory) throw new Error("اختر تصنيف الشكوى.");
        if(!moduleDescription.trim()) throw new Error("أدخل تفاصيل الشكوى.");
        const r=await supabase.rpc("create_grievance",{p_category_id:moduleCategory,p_grievance_type:moduleType||"GENERAL",p_subject:moduleTitle.trim(),p_description:moduleDescription.trim(),p_requested_action:moduleExtra.trim()||null,p_confidentiality_level:moduleConfidentiality,p_is_anonymous:moduleAnonymous,p_priority:modulePriority});
        if(r.error) throw r.error;
        Alert.alert("تم التقديم","تم تقديم الشكوى وحفظها في مسار المتابعة.");
      }else if(activeModule==="suggestions"){
        if(!moduleCategory) throw new Error("اختر تصنيف المقترح.");
        if(!moduleDescription.trim()) throw new Error("أدخل تفاصيل المقترح.");
        const cat=moduleLookups.find((x:any)=>String(x.id)===String(moduleCategory));
        const r=await supabase.rpc("create_suggestion",{p_category_code:String(pick(cat,["category_code"],moduleType||"GENERAL")),p_title:moduleTitle.trim(),p_description:moduleDescription.trim(),p_expected_benefit:moduleExtra.trim()||null,p_requested_action:moduleActionRequested||null,p_proposer_employee_id:(employee as any)?.id||null,p_department_id:(employee as any)?.department_id||null,p_priority:modulePriority});
        if(r.error) throw r.error;
        Alert.alert("تم التقديم","تم تقديم المقترح بنجاح.");
      }else if(activeModule==="services"){
        if(!moduleCategory) throw new Error("اختر نوع الخدمة.");
        if(!moduleDescription.trim()) throw new Error("أدخل تفاصيل الطلب.");
        const st=moduleLookups.find((x:any)=>String(x.id)===String(moduleCategory));
        const wf=await resolveServiceWorkflow();
        const r=await supabase.rpc("create_admin_service_request",{
          p_service_code:String(pick(st,["service_code"],"OTHER")),p_title:moduleTitle.trim(),p_description:moduleDescription.trim(),
          p_requester_employee_number:String(employee?.employee_number||""),p_branch_code:wf.branch,p_manager_employee_number:wf.manager||null,
          p_services_approver_employee_number:wf.servicesApprover||null,p_review_approver_employee_number:wf.reviewApprover||null,
          p_priority:modulePriority,p_required_date:moduleRequiredDate.trim()||null
        });
        if(r.error) throw r.error;
        Alert.alert("تم التقديم","تم تقديم طلب الخدمة وتحويله إلى مسار الموافقات.");
      }
      resetModuleForm();await loadModuleData(activeModule as any);
    }catch(e:any){Alert.alert("تعذر حفظ الطلب",errText(e));}
    finally{setBusy(false);}
  };

  const runModuleAction=async(action:string)=>{
    if(!moduleSelected?.id){Alert.alert("حدد السجل","اختر سجلاً أولاً.");return;}
    const {data:{user}}=await supabase.auth.getUser();if(!user)return;
    setBusy(true);
    try{
      if(activeModule==="assets"){
        let error:any=null;
        if(action==="assign"){
          if(!moduleEmployeeNo.trim()) throw new Error("أدخل الرقم الوظيفي للمستلم.");
          const empQ=await supabase.from("employees").select("id").eq("employee_number",moduleEmployeeNo.trim()).eq("is_active",true).maybeSingle();
          if(empQ.error) throw empQ.error;if(!empQ.data) throw new Error("لم يتم العثور على موظف نشط بهذا الرقم.");
          const r=await supabase.rpc("assign_asset",{p_asset_id:moduleSelected.id,p_employee_id:empQ.data.id,p_expected_return_date:null,p_handover_document_id:null,p_notes:moduleNotes||null});error=r.error;
        }else if(action==="return"){
          const a=await supabase.from("asset_assignments").select("id").eq("asset_id",moduleSelected.id).eq("assignment_status","active").order("assigned_at",{ascending:false}).limit(1).maybeSingle();
          if(a.error) throw a.error;if(!a.data) throw new Error("لا توجد عهدة نشطة لهذا الأصل.");
          const r=await supabase.rpc("return_asset",{p_assignment_id:a.data.id,p_condition_status:moduleCondition,p_missing_parts:null,p_damage_description:moduleNotes||null,p_notes:moduleNotes||null,p_document_id:null});error=r.error;
        }else if(action==="move"){
          if(!moduleEmployeeNo.trim()) throw new Error("أدخل الرقم الوظيفي للموظف الجديد.");
          const empQ=await supabase.from("employees").select("id").eq("employee_number",moduleEmployeeNo.trim()).eq("is_active",true).maybeSingle();
          if(empQ.error) throw empQ.error;if(!empQ.data) throw new Error("الموظف الجديد غير موجود.");
          const r=await supabase.rpc("move_asset",{p_asset_id:moduleSelected.id,p_to_location_id:null,p_to_employee_id:empQ.data.id,p_reference_type:"APP",p_reference_id:null,p_movement_reason:moduleNotes||"نقل عهدة"});error=r.error;
        }else if(action==="maintenance"){
          const r=await supabase.rpc("record_asset_maintenance",{p_asset_id:moduleSelected.id,p_maintenance_type:"GENERAL",p_problem_description:moduleNotes||"صيانة دورية",p_work_description:null,p_service_provider:null,p_start_date:new Date().toISOString().slice(0,10),p_end_date:null,p_estimated_cost:moduleCost?Number(moduleCost):null,p_actual_cost:null,p_maintenance_status:"open",p_warranty_covered:false,p_notes:moduleNotes||null});error=r.error;
        }else if(action==="inspection"){
          const r=await supabase.rpc("record_asset_inspection",{p_asset_id:moduleSelected.id,p_inspection_type:"PERIODIC",p_inspection_date:new Date().toISOString().slice(0,10),p_condition_status:moduleCondition,p_findings:moduleNotes||null,p_recommended_action:null,p_next_inspection_date:null,p_document_id:null});error=r.error;
        }else if(action==="dispose"){
          const r=await supabase.rpc("dispose_asset",{p_asset_id:moduleSelected.id,p_disposal_type:"other",p_disposal_reason:moduleNotes,p_approval_date:new Date().toISOString().slice(0,10),p_disposal_date:new Date().toISOString().slice(0,10),p_disposal_value:moduleCost?Number(moduleCost):null,p_disposal_recipient:null,p_document_id:null,p_notes:moduleNotes});error=r.error;
        }
        if(error) throw error;
      }else if(activeModule==="grievances"){
        if(action==="new_investigation"){
          const payload={grievance_id:moduleSelected.id,investigation_number:`INV-${Date.now()}`,investigation_title:`التحقيق في ${moduleSelected.subject||moduleSelected.grievance_number||"التظلم"}`,investigation_scope:moduleNotes||moduleSelected.description||null,assigned_investigator:user.id,investigation_status:"ASSIGNED",created_by:user.id};
          const r=await supabase.from("grievance_investigations").insert(payload).select("*").single();if(r.error) throw r.error;
        }else if(action==="start_investigation"){
          const r=await supabase.rpc("start_grievance_investigation",{p_investigation_id:moduleSelected.id});if(r.error) throw r.error;
        }else if(action==="complete_investigation"){
          if(!investigationFindings.trim()) throw new Error("أدخل نتائج التحقيق.");
          const r=await supabase.rpc("complete_grievance_investigation",{p_investigation_id:moduleSelected.id,p_findings:investigationFindings,p_recommendations:investigationRecommendations,p_conclusion:investigationConclusion});if(r.error) throw r.error;
        }
      }else if(activeModule==="suggestions"){
        const allowed=["UNDER_REVIEW","APPROVED","REJECTED","REFERRED","IN_PROGRESS","IMPLEMENTED","CLOSED"];
        if(!allowed.includes(action)) throw new Error("حالة المقترح غير معتمدة.");
        const r=await supabase.from("suggestions").update({status:action,updated_by:user.id,updated_at:new Date().toISOString(),management_decision:moduleNotes||moduleSelected.management_decision||null,decision_date:["APPROVED","REJECTED","REFERRED"].includes(action)?new Date().toISOString():moduleSelected.decision_date}).eq("id",moduleSelected.id).select("id");
        if(r.error) throw r.error;if(!r.data?.length) throw new Error("لم يتم تحديث المقترح؛ تحقق من صلاحيات المراجعة.");
      }else if(activeModule==="services"){
        if(action==="approve"){
          const r=await supabase.rpc("approve_admin_service_request",{p_request_id:moduleSelected.id});if(r.error) throw r.error;
        }else if(action==="reject"){
          const r=await supabase.rpc("reject_admin_service_request",{p_request_id:moduleSelected.id,p_reason:moduleNotes||"مرفوض"});if(r.error) throw r.error;
        }else if(action==="return"){
          const r=await supabase.rpc("return_admin_service_request",{p_request_id:moduleSelected.id,p_reason:moduleNotes||"إعادة للموظف"});if(r.error) throw r.error;
        }else if(action==="start"){
          const r=await supabase.rpc("start_admin_service_execution",{p_request_id:moduleSelected.id});if(r.error) throw r.error;
        }else if(action==="complete"){
          const r=await supabase.rpc("complete_admin_service_request",{p_request_id:moduleSelected.id,p_execution_notes:moduleNotes||null,p_final_result:moduleNotes||null});if(r.error) throw r.error;
        }else if(action==="close"){
          const r=await supabase.rpc("close_admin_service_request",{p_request_id:moduleSelected.id});if(r.error) throw r.error;
        }
      }
      Alert.alert("تم التنفيذ","تم حفظ الإجراء بنجاح.");
      await loadModuleData(activeModule as any);
    }catch(e:any){Alert.alert("تعذر تنفيذ الإجراء",errText(e));}
    finally{setBusy(false);}
  };
  const refreshModule=async()=>{if(activeModule==="reports"){await openModule("reports");}else{setBusy(true);try{await loadModuleData(activeModule as any);}catch(e:any){Alert.alert("تعذر التحديث",errText(e));}finally{setBusy(false);}}};
  const filteredModuleRows=moduleRows.filter((r:any)=>{const q=moduleSearch.trim().toLowerCase();return !q||JSON.stringify(r).toLowerCase().includes(q);});
  const selectModuleRow=async(r:any)=>{
    setModuleSelected(r);setModuleRelatedRows([]);
    if(activeModule==="assets"){
      const q=await supabase.from("asset_assignments").select("*").eq("asset_id",r.id).order("assigned_at",{ascending:false});
      if(!q.error)setModuleRelatedRows(q.data||[]);
    }
    if(activeModule==="grievances"){
      const q=await supabase.from("grievance_investigations").select("*").eq("grievance_id",r.id).order("created_at",{ascending:false});
      if(!q.error)setModuleRelatedRows(q.data||[]);
    }
  };

  const filteredWorkflowEmployees=workflowData.employees.filter((r:any)=>{
    const q=workflowSearch.trim().toLowerCase();
    return !q || employeeNoOf(r).toLowerCase().includes(q) || employeeNameOf(r).toLowerCase().includes(q);
  });
  const filteredBulkEmployees=workflowData.employees.filter((r:any)=>{
    const q=workflowBulkEmployeeSearch.trim().toLowerCase();
    return !q || employeeNoOf(r).toLowerCase().includes(q) || employeeNameOf(r).toLowerCase().includes(q);
  });
  const filteredBulkManagers=workflowData.managers.filter((r:any)=>{
    const q=workflowBulkManagerSearch.trim().toLowerCase();
    return !q || employeeNoOf(r).toLowerCase().includes(q) || employeeNameOf(r).toLowerCase().includes(q);
  });
  const managerNumbers=new Set(workflowData.managers.map((r:any)=>employeeNoOf(r)));

  const reset = () => {setScreen("dashboard");setSelectedSurvey(null);setAnswers({});setReason("");setResult(null);};
  const logout = async () => {await supabase.auth.signOut();setEmployee(null);setEmployeeNo("");setPassword("");setCatalog([]);setSelectedSurvey(null);setAdminRows([]);setRoleCodes([]);setPermissions({});setSystemAdmin(false);setEmployeesRows([]);setSelectedEmployeeRecord(null);setScreen("login");};

  return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/>
    {screen==="login" && <ScrollView contentContainerStyle={[s.container,{justifyContent:"center",flexGrow:1}]}>
      <View style={s.card}>
        <Field label="اسم المستخدم" value={employeeNo} onChangeText={setEmployeeNo} keyboardType="numeric" placeholder="اسم المستخدم"/>
        <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry placeholder="كلمة المرور"/>
        <Btn title={busy?"جاري التحقق...":"دخول"} disabled={busy} onPress={login}/>
      </View>
    </ScrollView>}

    {screen==="dashboard" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>مرحباً {employee?.employee_name}</Text><Text style={s.heroSub}>الرقم الوظيفي: {employee?.employee_number}</Text></View>
      <View style={s.card}><Text style={s.title}>خدمات النظام</Text><Text style={s.sub}>الأقسام الرئيسية — تظهر وظائف الإدارة والمراجعة وفق صلاحيات حسابك.</Text>
        <View style={s.mainGrid}>
          {(systemAdmin||permissions.SURVEYS_VIEW||permissions.SURVEYS_MANAGE)&&<MainSectionCard icon="clipboard-outline" title="الاستبيانات" badge={pendingCounts.surveys} text="المشاركة والاستبيانات والنتائج والتحليلات." onPress={async()=>{setBusy(true);try{await loadCatalog();setSurveyTab("mine");setScreen("surveyHub");if(employee?.is_survey_admin) await loadAdmin(adminSurveyId,employee?.employee_number);}catch(e:any){Alert.alert("تعذر تحميل الاستبيانات",errText(e));}finally{setBusy(false);}}}/>}
          {(systemAdmin||["GRIEVANCES_VIEW","GRIEVANCES_CREATE","GRIEVANCES_MANAGE","GRIEVANCES_INVESTIGATE","GRIEVANCES_DECIDE"].some(k=>permissions[k]))&&<MainSectionCard icon="shield-checkmark-outline" title="الشكاوى والتظلمات" badge={pendingCounts.grievances} text="تقديم الشكاوى ومتابعة الفحص والقرارات." onPress={()=>openModule("grievances")}/>}
          {(systemAdmin||["IDEAS_VIEW","IDEAS_CREATE","IDEAS_REVIEW","IDEAS_IMPLEMENT"].some(k=>permissions[k]))&&<MainSectionCard icon="bulb-outline" title="المقترحات" badge={pendingCounts.suggestions} text="إضافة الأفكار وتقييمها ومتابعة تنفيذها." onPress={()=>openModule("suggestions")}/>}
          {(systemAdmin||["SERVICES_VIEW","SERVICES_CREATE","SERVICES_MANAGE"].some(k=>permissions[k]))&&<MainSectionCard icon="briefcase-outline" title="الخدمات الإدارية" badge={pendingCounts.services} text="طلبات الخدمات ومسار الاعتماد والتنفيذ." onPress={()=>openModule("services")}/>}
          {(systemAdmin||["ASSETS_VIEW","ASSETS_CREATE","ASSETS_UPDATE","ASSETS_ASSIGN","ASSETS_MAINTAIN","ASSETS_MOVE","ASSETS_DISPOSE"].some(k=>permissions[k]))&&<MainSectionCard icon="cube-outline" title="العهد والأصول" badge={pendingCounts.assets} text="العهد المسجلة وتسليمها وإخلاؤها وصيانتها." onPress={()=>openModule("assets")}/>}
        </View>
      </View>
      {(systemAdmin||permissions.EMPLOYEES_VIEW||permissions.REPORTS_VIEW)&&<View style={s.card}><Text style={s.title}>أدوات الإدارة</Text><Text style={s.sub}>وظائف إدارية إضافية لا تظهر ضمن الأقسام الخمسة الرئيسية.</Text>{(systemAdmin||permissions.EMPLOYEES_VIEW)&&<Btn title="إدارة الموظفين" secondary onPress={openEmployeeManagement}/>}
        {(systemAdmin||permissions.REPORTS_VIEW)&&<Btn title="التقارير والمؤشرات" secondary onPress={()=>openModule("reports")}/>}
        {systemAdmin&&<Btn title="مسارات الموافقات" secondary onPress={openWorkflowManagement}/>}</View>}
      <Btn title="تسجيل الخروج" secondary onPress={logout}/>
    </ScrollView>}

    {screen==="surveyHub" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>مرحباً {employee?.employee_name}</Text><Text style={s.heroSub}>الرقم الوظيفي: {employee?.employee_number}</Text></View>
      <View style={s.card}><Text style={s.title}>الاستبيانات</Text><Text style={s.sub}>واجهة الموظف والمراجع داخل نفس القسم.</Text><View style={s.roleTabs}><Pressable onPress={()=>setSurveyTab("mine")} style={[s.roleTab,surveyTab==="mine"&&s.roleTabActive]}><Text style={[s.roleTabText,surveyTab==="mine"&&s.roleTabTextActive]}>طلباتي / مشاركاتي</Text></Pressable>{(systemAdmin||employee?.is_survey_admin||permissions.SURVEYS_MANAGE)&&<Pressable onPress={()=>{setSurveyTab("manage");setScreen("admin");}} style={[s.roleTab,surveyTab==="manage"&&s.roleTabActive]}><Text style={[s.roleTabText,surveyTab==="manage"&&s.roleTabTextActive]}>إدارة ومراجعة</Text></Pressable>}</View>{surveyTab==="mine"&&<><Text style={s.sectionTitle}>الاستبيانات النشطة</Text>
        {catalog.filter(x=>x.is_active).map(sv=><View key={sv.id} style={s.surveyCard}><Text style={s.surveyTitle}>{sv.survey_name}</Text><Text style={s.sub}>{sv.description||`${sv.questions?.length||0} سؤالاً`}</Text><Text style={s.status}>{dateOpen(sv.period)?"مفتوح للمشاركة":"مغلق حالياً"}</Text><Btn title="فتح الاستبيان" secondary={!dateOpen(sv.period)} onPress={()=>chooseSurvey(sv)}/></View>)}
        </>}
        {surveyTab==="manage"&&<View style={s.managerHint}><Text style={s.title}>إدارة ومراجعة الاستبيانات</Text><Text style={s.sub}>أنشئ الفترات، راجع المشاركات، واعرض المؤشرات والتصدير.</Text><Btn title="فتح لوحة الإدارة" onPress={()=>{setScreen("admin");loadAdmin(adminSurveyId,employee?.employee_number);}}/></View>}
        <Btn title="العودة إلى الرئيسية" secondary onPress={()=>setScreen("dashboard")}/>
        <Btn title="تسجيل الخروج" secondary onPress={logout}/>
      </View>
    </ScrollView>}

    {screen==="employee" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.card}><Text style={s.title}>بيانات الموظف</Text><Text style={s.sub}>{selectedSurvey?.survey_name}</Text>
        <View style={s.readonly}><Text style={s.label}>اسم الموظف</Text><Text style={s.readonlyText}>{employee?.employee_name}</Text></View>
        <View style={s.readonly}><Text style={s.label}>الرقم الوظيفي</Text><Text style={s.readonlyText}>{employee?.employee_number}</Text></View>
        <Choices label="القسم" values={DEPARTMENTS} value={department} onChange={setDepartment}/>
        <Choices label="الدرجة الوظيفية" values={GRADES} value={grade} onChange={setGrade}/>
        <Field label="سنوات الخدمة" value={years} onChangeText={setYears} keyboardType="numeric" placeholder="من 1 إلى 30"/>
        <Choices label="المؤهل" values={QUALIFICATIONS} value={qualification} onChange={setQualification}/>
        <Btn title={busy?"جاري التحقق...":"متابعة إلى الأسئلة"} disabled={busy} onPress={startSurvey}/>
        <Btn title="رجوع" secondary onPress={()=>setScreen("surveyHub")}/>
      </View>
    </ScrollView>}

    {screen==="survey" && <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==="ios"?"padding":undefined}>
      <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
        <View style={s.card}><Text style={s.title}>{selectedSurvey?.survey_name}</Text><Text style={s.sub}>أجبت عن {Object.keys(answers).length} من {questions.length} — {progress}%</Text><View style={s.progress}><View style={[s.fill,{width:`${progress}%`}]}/></View></View>
        {Array.from(new Set<number>(questions.map(q=>q.domain_no))).sort((a,b)=>a-b).map(d=>{
          const group=questions.filter(q=>q.domain_no===d); const domainName=group[0]?.domain_name||`المجال ${d}`;
          return <View key={d}><Text style={s.domain}>{domainName}</Text>{group.map(q=><View key={q.question_no} style={s.qcard}>
            <Text style={s.qno}>السؤال {q.question_no}</Text><Text style={s.question}>{q.question_text}</Text>
            <View style={s.scale}>{(selectedSurvey?.id===3?SCALE_LOYALTY:selectedSurvey?.id===2?SCALE_2:SCALE_1).map(x=><Pressable key={x[0]} onPress={()=>setAnswers(a=>({...a,[q.question_no]:x[0]}))} style={[s.scaleItem,answers[q.question_no]===x[0]&&s.active]}><Text style={[s.val,answers[q.question_no]===x[0]&&s.white]}>{x[0]}</Text><Text style={[s.lbl,answers[q.question_no]===x[0]&&s.white]}>{x[1]}</Text></Pressable>)}</View>
          </View>)}</View>;
        })}
        {selectedSurvey?.id===1 && <View style={s.qcard}><Text style={s.qno}>ملاحظة مفتوحة</Text><Text style={s.question}>الأسباب التي أثرت على معنوياتك.</Text><TextInput value={reason} onChangeText={setReason} multiline style={[s.input,{height:100,textAlignVertical:"top"}]} placeholder="اكتب الأسباب إن وجدت..."/></View>}
        <Btn title={busy?"جاري الحفظ...":"إرسال الاستبيان"} disabled={busy} onPress={submit}/><Btn title="رجوع" secondary onPress={()=>setScreen("employee")}/>
      </ScrollView>
    </KeyboardAvoidingView>}

    {screen==="result" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}><View style={s.card}><Text style={s.done}>✓</Text><Text style={s.title}>تم تسجيل الاستبيان بنجاح</Text><Text style={s.body}>تم حفظ إجاباتك وحساب متوسطات المجالات والنتيجة الإجمالية.</Text>{result&&<><Score title="المجال الأول" v={result.d1}/><Score title="المجال الثاني" v={result.d2}/><Score title="المجال الثالث" v={result.d3}/><Score title="النتيجة الإجمالية" v={result.total} total/></>}<Btn title="إنهاء" onPress={reset}/></View></ScrollView>}

    {screen==="admin" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>لوحة إدارة الاستبيانات</Text><Text style={s.heroSub}>{employee?.employee_name} — مدير النظام</Text></View>
      <View style={s.card}><Text style={s.title}>اختيار الاستبيان</Text><View style={s.chips}>{catalog.map(sv=><Pressable key={sv.id} onPress={()=>{setAdminSurveyId(sv.id);setPeriodStart(sv.period?.start_at||"");setPeriodEnd(sv.period?.end_at||"");setPeriodEnabled(!!sv.period?.is_enabled);loadAdmin(sv.id);}} style={[s.chip,adminSurveyId===sv.id&&s.chipActive]}><Text style={[s.chipText,adminSurveyId===sv.id&&s.white]}>{sv.survey_name}</Text></Pressable>)}</View>
        <Text style={s.sectionTitle}>مؤشرات المشاركة</Text><View style={s.metrics}><Metric title="عدد المشاركات" value={String(adminStats.count)}/><Metric title="المتوسط العام" value={`${adminStats.overall.toFixed(2)} / 5`}/></View>
        <Text style={s.sectionTitle}>الرسم البياني لمتوسطات المجالات</Text>
        {adminSurveyId===3 ? <><AverageBar title="الولاء الوظيفي" value={adminStats.d1}/><AverageBar title="المتوسط العام" value={adminStats.overall}/></> : <><AverageBar title="المجال الأول" value={adminStats.d1}/><AverageBar title="المجال الثاني" value={adminStats.d2}/><AverageBar title="المجال الثالث" value={adminStats.d3}/><AverageBar title="المتوسط العام" value={adminStats.overall}/></>}
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
    {screen==="employees" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>إدارة ملفات الموظفين</Text><Text style={s.heroSub}>عرض وبحث وتحديث بيانات الموظفين وفق الصلاحيات الممنوحة</Text></View>
      <View style={s.card}>
        <Text style={s.title}>ملخص السجل الوظيفي</Text>
        <View style={s.metrics}>
          <Metric title="إجمالي السجلات المحملة" value={String(employeesRows.length)}/>
          <Metric title="الموظفون النشطون" value={String(activeEmployeesCount)}/>
          <Metric title="غير النشطين" value={String(inactiveEmployeesCount)}/>
        </View>
        <Field label="البحث عن موظف" value={employeeSearch} onChangeText={setEmployeeSearch} placeholder="الاسم أو الرقم الوظيفي أو المسمى"/>
        <Text style={s.sub}>يعرض التطبيق أول 100 نتيجة مطابقة. اضغط على الموظف لعرض بياناته.</Text>
        {filteredEmployees.map((r:any)=><Pressable key={String(r.id)} onPress={()=>{
          setSelectedEmployeeRecord(r);
          setEditEmployeeJobTitle(String(r.job_title||""));
          setEditEmployeeActive(r.is_active===true);
        }} style={[s.responseCard,selectedEmployeeRecord?.id===r.id&&{borderColor:C.primary,backgroundColor:C.pale}]}>
          <Text style={s.responseTitle}>{r.employee_name||"بدون اسم"} — {r.employee_number}</Text>
          <Text style={s.smallMuted}>{r.job_title||"المسمى الوظيفي غير محدد"}</Text>
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

    {screen==="module" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>{activeModule==="reports"?"التقارير ومؤشرات الأداء":moduleConfig[activeModule].title}</Text><Text style={s.heroSub}>{activeModule==="reports"?"":activeModule==="assets"?"العهد الحالية وتفاصيل الأصل والاستلام والإرجاع والنقل والصيانة والفحص.":activeModule==="grievances"?"تقديم الشكوى ومتابعة الحالة والسرية والتحقيقات.":activeModule==="suggestions"?"تقديم المقترح ومتابعة التقييم والقرار والتنفيذ.":"طلب التصاريح والخدمات ومتابعة رقم الطلب والمرحلة ومسار الموافقات."}</Text></View>
      {activeModule!=="reports"&&<View style={s.card}><View style={s.roleTabs}><Pressable onPress={()=>setModuleTab("mine")} style={[s.roleTab,moduleTab==="mine"&&s.roleTabActive]}><Text style={[s.roleTabText,moduleTab==="mine"&&s.roleTabTextActive]}>طلباتي / مشاركاتي</Text></Pressable>{moduleTabCanReview(activeModule)&&<Pressable onPress={()=>setModuleTab("manage")} style={[s.roleTab,moduleTab==="manage"&&s.roleTabActive]}><Text style={[s.roleTabText,moduleTab==="manage"&&s.roleTabTextActive]}>إدارة ومراجعة</Text></Pressable>}</View></View>}

      {activeModule==="reports" ? <>
        {(Object.entries(reportRows) as [string,any[]][]).map(([view,rows])=><View key={view} style={s.card}><Text style={s.title}>{({v_hr_dashboard_summary:"ملخص لوحة الموارد البشرية",v_hr_pending_approval_dashboard:"الموافقات المعلقة",v_admin_service_kpi:"مؤشرات الخدمات الإدارية",v_suggestions_kpi:"مؤشرات المقترحات",v_grievances_kpi:"مؤشرات الشكاوى",v_grievance_investigation_kpi:"مؤشرات التحقيقات",v_admin_service_status:"حالات طلبات الخدمات",v_suggestions_status:"حالات المقترحات",v_grievances_status:"حالات الشكاوى"} as any)[view]||view}</Text>{rows.length?rows.slice(0,30).map((r:any,i:number)=><View key={i} style={s.responseCard}><Text style={s.answerText}>{Object.entries(r).map(([k,v])=>`${k}: ${v??"—"}`).join(" | ")}</Text></View>):<Text style={s.empty}>لا توجد بيانات متاحة.</Text>}</View>)}
      </> : <>
        <View style={s.card}><Text style={s.title}>{activeModule==="assets"?"العهد والأصول":activeModule==="grievances"?"الشكاوى والتظلمات":activeModule==="suggestions"?"المقترحات":"طلبات الخدمات والتصاريح"}</Text>
          <Field label="البحث" value={moduleSearch} onChangeText={setModuleSearch} placeholder="الاسم أو الرقم أو الحالة"/><Text style={s.smallMuted}>السجلات: {filteredModuleRows.length}</Text>
          {filteredModuleRows.filter((r:any)=>moduleTab==="manage" || String(pick(r,["requester_employee_number","employee_number","complainant_employee_number","requester_user_id","submitted_by","created_by"],""))===String(employee?.employee_number||(employee as any)?.user_id||"") || String(r.current_holder_employee_id||"")===String((employee as any)?.id||"")).map((r:any,i:number)=><Pressable key={String(r.id||i)} onPress={()=>selectModuleRow(r)} style={[s.responseCard,moduleSelected?.id===r.id&&{borderColor:C.primary,backgroundColor:C.pale}]}>
            <Text style={s.responseTitle}>{String(pick(r,[activeModule==="assets"?"asset_name":activeModule==="grievances"?"subject":activeModule==="suggestions"?"title":"title","request_number","grievance_number","suggestion_number","asset_code","id"],"سجل"))}</Text>
            <Text style={s.smallMuted}>{activeModule==="services"?`${String(pick(r,["request_number"],"بدون رقم"))} | ${String(pick(r,["status"],"—"))} | ${String(pick(r,["current_stage"],"—"))}`:`${String(pick(r,["status","asset_status","assignment_status","condition_status","priority"],"—"))} | ${String(pick(r,["created_at","submission_date","assigned_at"],""))}`}</Text>
            <Text style={s.answerText}>{String(pick(r,["description","subject","title","notes"],""))}</Text>
          </Pressable>)}
          {!filteredModuleRows.length&&<Text style={s.empty}>{activeModule==="assets"&&!systemAdmin?"لا توجد عهد حالية مرتبطة بحسابك.":"لا توجد سجلات مطابقة."}</Text>}
          <Btn title="تحديث السجلات" secondary disabled={busy} onPress={refreshModule}/>
          {(systemAdmin||permissions[moduleConfig[activeModule].create])&&activeModule!=="assets"&&<Btn title={`تقديم ${moduleConfig[activeModule].label}`} onPress={()=>{resetModuleForm();setModuleShowForm(true);}}/>}
          {(systemAdmin||permissions.ASSETS_ASSIGN)&&activeModule==="assets"&&<Btn title="تسجيل عهدة / تسليم أصل" onPress={()=>{resetModuleForm();setModuleShowForm(true);}}/>}
        </View>

        {moduleShowForm&&<View style={s.card}><Text style={s.title}>{activeModule==="assets"?"تسجيل عهدة / أصل":activeModule==="grievances"?"تقديم شكوى":activeModule==="suggestions"?"تقديم مقترح":"طلب تصريح / خدمة إدارية"}</Text>
          {activeModule==="assets"&&<><Field label="رمز الأصل" value={moduleExtra} onChangeText={setModuleExtra} placeholder="مثال: AST-0001"/><Field label="اسم الأصل" value={moduleTitle} onChangeText={setModuleTitle} placeholder="اسم الأصل"/><Text style={s.label}>تصنيف الأصل</Text><View style={s.chips}>{moduleLookups.map((x:any)=><Pressable key={String(x.id)} onPress={()=>setModuleCategory(String(x.id))} style={[s.chip,moduleCategory===String(x.id)&&s.chipActive]}><Text style={[s.chipText,moduleCategory===String(x.id)&&s.white]}>{String(pick(x,["category_name","category_code"],"تصنيف"))}</Text></Pressable>)}</View><Field label="الرقم الوظيفي للعهدة" value={moduleEmployeeNo} onChangeText={setModuleEmployeeNo} keyboardType="numeric" placeholder="رقم الموظف المستلم"/><Field label="تفاصيل الأصل" value={moduleDescription} onChangeText={setModuleDescription} placeholder="الوصف" multiline/></>}
          {activeModule==="grievances"&&<><Text style={s.label}>التصنيف</Text><View style={s.chips}>{moduleLookups.map((x:any)=><Pressable key={String(x.id)} onPress={()=>setModuleCategory(String(x.id))} style={[s.chip,moduleCategory===String(x.id)&&s.chipActive]}><Text style={[s.chipText,moduleCategory===String(x.id)&&s.white]}>{String(pick(x,["category_name","category_code"],"تصنيف"))}</Text></Pressable>)}</View><Field label="نوع الشكوى" value={moduleType} onChangeText={setModuleType} placeholder="GENERAL"/><Field label="العنوان" value={moduleTitle} onChangeText={setModuleTitle} placeholder="عنوان الشكوى"/><Field label="التفاصيل" value={moduleDescription} onChangeText={setModuleDescription} placeholder="تفاصيل الشكوى" multiline/><Text style={s.label}>الأولوية</Text><View style={s.chips}>{[["LOW","منخفضة"],["NORMAL","عادية"],["HIGH","عالية"],["URGENT","عاجلة"]].map(([v,l])=><Pressable key={v} onPress={()=>setModulePriority(v)} style={[s.chip,modulePriority===v&&s.chipActive]}><Text style={[s.chipText,modulePriority===v&&s.white]}>{l}</Text></Pressable>)}</View><Text style={s.label}>السرية</Text><View style={s.chips}>{[["normal","عادية"],["high","عالية"],["strict","مشددة"]].map(([v,l])=><Pressable key={v} onPress={()=>setModuleConfidentiality(v)} style={[s.chip,moduleConfidentiality===v&&s.chipActive]}><Text style={[s.chipText,moduleConfidentiality===v&&s.white]}>{l}</Text></Pressable>)}</View><Pressable onPress={()=>setModuleAnonymous(v=>!v)} style={s.toggle}><Text style={s.label}>الشكوى المجهولة</Text><Text style={[s.toggleValue,{color:moduleAnonymous?C.success:C.muted}]}>{moduleAnonymous?"مفعلة":"غير مفعلة"}</Text></Pressable><Field label="الإجراء المطلوب" value={moduleExtra} onChangeText={setModuleExtra} placeholder="ما الإجراء الذي تطلبه؟" multiline/></>}
          {activeModule==="suggestions"&&<><Text style={s.label}>التصنيف</Text><View style={s.chips}>{moduleLookups.map((x:any)=><Pressable key={String(x.id)} onPress={()=>setModuleCategory(String(x.id))} style={[s.chip,moduleCategory===String(x.id)&&s.chipActive]}><Text style={[s.chipText,moduleCategory===String(x.id)&&s.white]}>{String(pick(x,["category_name","category_code"],"تصنيف"))}</Text></Pressable>)}</View><Field label="العنوان" value={moduleTitle} onChangeText={setModuleTitle} placeholder="عنوان المقترح"/><Field label="التفاصيل" value={moduleDescription} onChangeText={setModuleDescription} placeholder="تفاصيل المقترح" multiline/><Field label="الفائدة المتوقعة" value={moduleExtra} onChangeText={setModuleExtra} placeholder="ما الفائدة المتوقعة؟" multiline/><Field label="الإجراء المطلوب" value={moduleActionRequested} onChangeText={setModuleActionRequested} placeholder="الإجراء المقترح للتنفيذ" multiline/><Text style={s.label}>الأولوية</Text><View style={s.chips}>{[["LOW","منخفضة"],["NORMAL","عادية"],["HIGH","عالية"],["URGENT","عاجلة"]].map(([v,l])=><Pressable key={v} onPress={()=>setModulePriority(v)} style={[s.chip,modulePriority===v&&s.chipActive]}><Text style={[s.chipText,modulePriority===v&&s.white]}>{l}</Text></Pressable>)}</View></>}
          {activeModule==="services"&&<><Text style={s.label}>نوع التصريح / الخدمة</Text><View style={s.chips}>{moduleLookups.map((x:any)=><Pressable key={String(x.id)} onPress={()=>setModuleCategory(String(x.id))} style={[s.chip,moduleCategory===String(x.id)&&s.chipActive]}><Text style={[s.chipText,moduleCategory===String(x.id)&&s.white]}>{String(pick(x,["service_name","service_code"],"خدمة"))}</Text></Pressable>)}</View><Field label="العنوان" value={moduleTitle} onChangeText={setModuleTitle} placeholder="عنوان الطلب"/><Field label="التفاصيل" value={moduleDescription} onChangeText={setModuleDescription} placeholder="تفاصيل الطلب" multiline/><Text style={s.label}>الفرع</Text><View style={s.chips}>{[["NAQIL","النقيل"],["ADMINISTRATION","الإدارة"]].map(([v,l])=><Pressable key={v} onPress={()=>setModuleBranch(v)} style={[s.chip,moduleBranch===v&&s.chipActive]}><Text style={[s.chipText,moduleBranch===v&&s.white]}>{l}</Text></Pressable>)}</View><Text style={s.label}>الأولوية</Text><View style={s.chips}>{[["LOW","منخفضة"],["NORMAL","عادية"],["HIGH","عالية"],["URGENT","عاجلة"]].map(([v,l])=><Pressable key={v} onPress={()=>setModulePriority(v)} style={[s.chip,modulePriority===v&&s.chipActive]}><Text style={[s.chipText,modulePriority===v&&s.white]}>{l}</Text></Pressable>)}</View><Field label="التاريخ المطلوب" value={moduleRequiredDate} onChangeText={setModuleRequiredDate} placeholder="YYYY-MM-DD"/></>}
          <Btn title="إرسال الطلب" disabled={busy} onPress={saveModuleRecord}/><Btn title="إلغاء" secondary onPress={resetModuleForm}/>
        </View>}

        {moduleSelected&&<View style={s.card}><Text style={s.title}>تفاصيل السجل</Text>
          {activeModule==="services"&&<><View style={s.metrics}><Metric title="رقم الطلب" value={String(pick(moduleSelected,["request_number"],"—"))}/><Metric title="الحالة" value={String(pick(moduleSelected,["status"],"—"))}/></View><View style={s.metrics}><Metric title="المرحلة" value={String(pick(moduleSelected,["current_stage"],"—"))}/><Metric title="المسؤول" value={String(pick(moduleSelected,["current_assignee","manager_employee_number","services_approver_employee_number"],"—"))}/></View><Text style={s.sectionTitle}>مسار الموافقات</Text><Text style={s.body}>المدير المباشر ← الخدمات الإدارية ← المراجعة</Text></>}
          {activeModule!=="services"&&Object.entries(moduleSelected).map(([k,v])=><View key={k} style={s.answerLine}><Text style={s.answerText}>{k}: {String(v??"—")}</Text></View>)}
          {activeModule==="assets"&&<><Text style={s.sectionTitle}>العهدة والإجراءات</Text>{moduleRelatedRows.map((a:any)=><View key={String(a.id)} style={s.responseCard}><Text style={s.responseTitle}>الموظف: {String(pick(a,["employee_id"],"—"))}</Text><Text style={s.smallMuted}>الحالة: {String(pick(a,["assignment_status"],"—"))} | الاستلام: {String(pick(a,["assigned_at"],"—"))}</Text><Text style={s.smallMuted}>الإرجاع: {String(pick(a,["returned_at"],"لم يرجع بعد"))}</Text></View>)}<Field label="رقم الموظف" value={moduleEmployeeNo} onChangeText={setModuleEmployeeNo} keyboardType="numeric" placeholder="رقم الموظف"/><Field label="ملاحظات / سبب الإجراء" value={moduleNotes} onChangeText={setModuleNotes} placeholder="التفاصيل"/><Text style={s.label}>حالة الأصل عند الإرجاع</Text><View style={s.chips}>{[["new","جديد"],["excellent","ممتاز"],["good","جيد"],["fair","مقبول"],["poor","ضعيف"],["damaged","تالف"]].map(([v,l])=><Pressable key={v} onPress={()=>setModuleCondition(v)} style={[s.chip,moduleCondition===v&&s.chipActive]}><Text style={[s.chipText,moduleCondition===v&&s.white]}>{l}</Text></Pressable>)}</View><View style={s.chips}><Btn title="استلام / تسليم" onPress={()=>runModuleAction("assign")}/><Btn title="إرجاع" secondary onPress={()=>runModuleAction("return")}/><Btn title="نقل" secondary onPress={()=>runModuleAction("move")}/><Btn title="صيانة" secondary onPress={()=>runModuleAction("maintenance")}/><Btn title="فحص" secondary onPress={()=>runModuleAction("inspection")}/></View></>}
          {activeModule==="grievances"&&<><Text style={s.sectionTitle}>التحقيقات المرتبطة</Text><Field label="نطاق التحقيق / ملاحظات" value={moduleNotes} onChangeText={setModuleNotes} placeholder="تفاصيل نطاق التحقيق"/><Btn title="إنشاء تحقيق" onPress={()=>runModuleAction("new_investigation")}/>{moduleRelatedRows.map((inv:any)=><View key={String(inv.id)} style={s.responseCard}><Text style={s.responseTitle}>{inv.investigation_number||"تحقيق"} — {inv.investigation_status}</Text><Text style={s.answerText}>{inv.investigation_title||""}</Text></View>)}<Field label="نتائج التحقيق" value={investigationFindings} onChangeText={setInvestigationFindings} placeholder="النتائج" multiline/><Field label="التوصيات" value={investigationRecommendations} onChangeText={setInvestigationRecommendations} placeholder="التوصيات" multiline/><Field label="الخلاصة" value={investigationConclusion} onChangeText={setInvestigationConclusion} placeholder="الخلاصة" multiline/><Btn title="بدء التحقيق" secondary onPress={()=>runModuleAction("start_investigation")}/><Btn title="إكمال التحقيق" secondary onPress={()=>runModuleAction("complete_investigation")}/></>}
          {activeModule==="suggestions"&&<><Text style={s.sectionTitle}>التقييم والقرار والتنفيذ</Text><Text style={s.body}>الحالة الحالية: {String(pick(moduleSelected,["status"],"—"))}</Text><Text style={s.body}>التقييم: {String(pick(moduleSelected,["evaluation","evaluation_score","evaluation_result"],"لم يتم التقييم بعد"))}</Text><Text style={s.body}>القرار: {String(pick(moduleSelected,["management_decision","decision"],"لم يصدر بعد"))}</Text><Text style={s.body}>التنفيذ: {String(pick(moduleSelected,["implementation_status","implementation_notes"],"غير محدد"))}</Text><Field label="قرار / ملاحظات" value={moduleNotes} onChangeText={setModuleNotes} placeholder="ملاحظات الإدارة"/><View style={s.chips}>{[["UNDER_REVIEW","قيد المراجعة"],["APPROVED","معتمد"],["REJECTED","مرفوض"],["REFERRED","محال"],["IN_PROGRESS","قيد التنفيذ"],["IMPLEMENTED","منفذ"],["CLOSED","مغلق"]].map(([v,l])=><Pressable key={v} onPress={()=>runModuleAction(v)} style={s.chip}><Text style={s.chipText}>{l}</Text></Pressable>)}</View></>}
          {activeModule==="services"&&<><Text style={s.sectionTitle}>إجراءات الموافقة والتنفيذ</Text><Field label="ملاحظات الإجراء" value={moduleNotes} onChangeText={setModuleNotes} placeholder="ملاحظات" multiline/><View style={s.chips}><Btn title="اعتماد" onPress={()=>runModuleAction("approve")}/><Btn title="إرجاع" secondary onPress={()=>runModuleAction("return")}/><Btn title="رفض" secondary onPress={()=>runModuleAction("reject")}/><Btn title="بدء التنفيذ" secondary onPress={()=>runModuleAction("start")}/><Btn title="إكمال" secondary onPress={()=>runModuleAction("complete")}/><Btn title="إغلاق" secondary onPress={()=>runModuleAction("close")}/></View></>}
        </View>}
      </>}
      <Btn title="العودة إلى خدمات النظام" secondary onPress={()=>{setScreen("dashboard");setModuleSelected(null);}}/>
    </ScrollView>}

    {screen==="notifications" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>الإشعارات والإجراءات المعلقة</Text><Text style={s.heroSub}>متابعة الطلبات التي تحتاج إلى إجراء من حسابك.</Text></View>
      <View style={s.card}>
        <View style={s.noticeRow}><View style={s.noticeIcon}><Ionicons name="notifications-outline" size={24} color={C.primary}/></View><View style={{flex:1}}><Text style={s.title}>ملخص الإجراءات</Text><Text style={s.sub}>الشكاوى: {pendingCounts.grievances} | المقترحات: {pendingCounts.suggestions}</Text><Text style={s.sub}>الخدمات: {pendingCounts.services} | الاستبيانات: {pendingCounts.surveys}</Text></View></View>
      </View>
      {pendingCounts.grievances>0&&<View style={s.card}><Text style={s.title}>الشكاوى والتظلمات</Text><Text style={s.sub}>يوجد {pendingCounts.grievances} سجل يحتاج إلى متابعة.</Text><Btn title="فتح الشكاوى" secondary onPress={()=>openModule("grievances")}/></View>}
      {pendingCounts.suggestions>0&&<View style={s.card}><Text style={s.title}>المقترحات</Text><Text style={s.sub}>يوجد {pendingCounts.suggestions} مقترحاً يحتاج إلى متابعة.</Text><Btn title="فتح المقترحات" secondary onPress={()=>openModule("suggestions")}/></View>}
      {pendingCounts.services>0&&<View style={s.card}><Text style={s.title}>الخدمات الإدارية</Text><Text style={s.sub}>يوجد {pendingCounts.services} طلب خدمة يحتاج إلى متابعة.</Text><Btn title="فتح الخدمات" secondary onPress={()=>openModule("services")}/></View>}
      {pendingCounts.surveys>0&&<View style={s.card}><Text style={s.title}>الاستبيانات</Text><Text style={s.sub}>توجد {pendingCounts.surveys} فترة/إجراء متاح للمراجعة.</Text><Btn title="فتح الاستبيانات" secondary onPress={async()=>{setBusy(true);try{await loadCatalog();setSurveyTab("manage");setScreen("surveyHub");}catch(e:any){Alert.alert("تعذر الفتح",errText(e));}finally{setBusy(false);}}}/></View>}
      {!pendingCounts.grievances&&!pendingCounts.suggestions&&!pendingCounts.services&&!pendingCounts.surveys&&<View style={s.card}><Text style={s.empty}>لا توجد إجراءات معلقة حالياً.</Text></View>}
      <Btn title="تحديث الإشعارات" secondary disabled={busy} onPress={loadPendingCounts}/>
    </ScrollView>}

    {screen==="settings" && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>الإعدادات</Text><Text style={s.heroSub}>إدارة حسابك وإعدادات التطبيق.</Text></View>
      <View style={s.card}><View style={s.profileHead}><View style={s.profileIcon}><Ionicons name="person-outline" size={30} color={C.primary}/></View><View style={{flex:1}}><Text style={s.title}>{employee?.employee_name||"المستخدم"}</Text><Text style={s.sub}>الرقم الوظيفي: {employee?.employee_number||"—"}</Text></View></View>
        <Btn title="تسجيل الخروج" secondary onPress={logout}/>
      </View>
    </ScrollView>}

    {screen==="workflow" && systemAdmin && <ScrollView contentContainerStyle={[s.container,{paddingBottom:105}]}>
      <View style={s.hero}><Text style={s.heroTitle}>مسارات الموافقات</Text><Text style={s.heroSub}>إعداد المدير المباشر ومسؤولي الخدمات والمراجعة حسب الفرع</Text></View>
      <View style={s.card}><Text style={s.title}>1. تعيين المدير المباشر لموظف واحد</Text><Text style={s.sub}>ابحث بالاسم أو الرقم الوظيفي، ثم اختر الموظف من القائمة المنسدلة. البحث يشمل جميع الموظفين النشطين المحملين من قاعدة البيانات.</Text>
        <Pressable style={s.dropdownButton} onPress={()=>setWorkflowEmployeePickerOpen(v=>!v)}><Text style={s.dropdownButtonText}>{workflowSelectedEmployee?`${employeeNameOf(workflowSelectedEmployee)} — ${employeeNoOf(workflowSelectedEmployee)}`:"اضغط لاختيار الموظف"}</Text><Text style={s.dropdownArrow}>{workflowEmployeePickerOpen?"▲":"▼"}</Text></Pressable>
        {workflowEmployeePickerOpen&&<View style={s.dropdownPanel}><TextInput value={workflowSearch} onChangeText={setWorkflowSearch} style={s.input} placeholder="ابحث بالاسم أو الرقم الوظيفي" placeholderTextColor="#9AA3AD" textAlign="right"/><Text style={s.smallMuted}>نتائج البحث: {filteredWorkflowEmployees.length} موظف</Text><ScrollView nestedScrollEnabled style={s.dropdownList} keyboardShouldPersistTaps="handled">{filteredWorkflowEmployees.map((r:any)=>{
          const no=employeeNoOf(r); const selected=employeeNoOf(workflowSelectedEmployee)===no;
          const currentManager=String(pick(r,["manager_employee_number","manager_number"],""));
          const currentBranch=String(pick(r,["branch_code"],""));
          return <Pressable key={no} onPress={()=>{setWorkflowSelectedEmployee(r);setWorkflowManager(currentManager);if(currentBranch)setWorkflowBranch(currentBranch);setWorkflowEmployeePickerOpen(false);}} style={[s.dropdownOption,selected&&s.dropdownOptionActive]}><Text style={[s.dropdownOptionText,selected&&{color:C.dark,fontWeight:"800"}]}>{employeeNameOf(r)} — {no}</Text></Pressable>;
        })}{!filteredWorkflowEmployees.length&&<Text style={s.empty}>لا توجد نتائج مطابقة.</Text>}</ScrollView></View>}
        {workflowSelectedEmployee&&<View style={s.selectedPanel}><Text style={s.label}>الموظف المحدد: {employeeNameOf(workflowSelectedEmployee)} ({employeeNoOf(workflowSelectedEmployee)})</Text>
          <Text style={s.label}>الفرع</Text><View style={s.chips}>{workflowData.branches.map((b:any)=><Pressable key={branchCodeOf(b)} onPress={()=>setWorkflowBranch(branchCodeOf(b))} style={[s.chip,workflowBranch===branchCodeOf(b)&&s.chipActive]}><Text style={[s.chipText,workflowBranch===branchCodeOf(b)&&s.white]}>{branchNameOf(b)}</Text></Pressable>)}</View>
          <Text style={s.label}>المدير المباشر</Text><View style={s.chips}>{workflowData.managers.map((m:any)=><Pressable key={employeeNoOf(m)} onPress={()=>setWorkflowManager(employeeNoOf(m))} style={[s.chip,workflowManager===employeeNoOf(m)&&s.chipActive]}><Text style={[s.chipText,workflowManager===employeeNoOf(m)&&s.white]}>{employeeNameOf(m)} ({employeeNoOf(m)})</Text></Pressable>)}</View>
          <Btn title="حفظ تعيين الموظف" disabled={busy} onPress={saveEmployeeWorkflowAssignment}/>
        </View>}
      </View>
      <View style={s.card}><Text style={s.title}>2. إسناد مجموعة موظفين إلى مدير مباشر</Text><Text style={s.sub}>اختر المدير أولاً، ثم ابحث عن الموظفين وحددهم دفعة واحدة. يمكنك تحديد كل نتائج البحث أو إلغاء تحديدها. لا يقتصر الاختيار على أول عدد من الموظفين.</Text>
        <Text style={s.label}>المدير المباشر</Text>
        <Pressable style={s.dropdownButton} onPress={()=>setWorkflowBulkManagerPickerOpen(v=>!v)}><Text style={s.dropdownButtonText}>{workflowBulkManager?(()=>{const m=workflowData.managers.find((x:any)=>employeeNoOf(x)===workflowBulkManager);return m?`${employeeNameOf(m)} — ${workflowBulkManager}`:workflowBulkManager;})():"اختر المدير المباشر"}</Text><Text style={s.dropdownArrow}>{workflowBulkManagerPickerOpen?"▲":"▼"}</Text></Pressable>
        {workflowBulkManagerPickerOpen&&<View style={s.dropdownPanel}><TextInput value={workflowBulkManagerSearch} onChangeText={setWorkflowBulkManagerSearch} style={s.input} placeholder="ابحث عن المدير بالاسم أو الرقم" placeholderTextColor="#9AA3AD" textAlign="right"/><ScrollView nestedScrollEnabled style={s.dropdownList} keyboardShouldPersistTaps="handled">{filteredBulkManagers.map((m:any)=><Pressable key={employeeNoOf(m)} onPress={()=>{setWorkflowBulkManager(employeeNoOf(m));setWorkflowBulkManagerPickerOpen(false);}} style={[s.dropdownOption,workflowBulkManager===employeeNoOf(m)&&s.dropdownOptionActive]}><Text style={s.dropdownOptionText}>{employeeNameOf(m)} — {employeeNoOf(m)}</Text></Pressable>)}{!filteredBulkManagers.length&&<Text style={s.empty}>لا يوجد مدير مطابق.</Text>}</ScrollView></View>}
        <Text style={s.label}>فرع التعيين</Text><View style={s.chips}>{workflowData.branches.map((b:any)=><Pressable key={branchCodeOf(b)} onPress={()=>setWorkflowBranch(branchCodeOf(b))} style={[s.chip,workflowBranch===branchCodeOf(b)&&s.chipActive]}><Text style={[s.chipText,workflowBranch===branchCodeOf(b)&&s.white]}>{branchNameOf(b)}</Text></Pressable>)}</View>
        <Text style={s.label}>البحث وتحديد الموظفين</Text><TextInput value={workflowBulkEmployeeSearch} onChangeText={setWorkflowBulkEmployeeSearch} style={s.input} placeholder="الاسم أو الرقم الوظيفي" placeholderTextColor="#9AA3AD" textAlign="right"/>
        <View style={s.bulkActions}><Text style={s.smallMuted}>المحددون: {workflowBulkSelectedEmployees.length} من إجمالي {workflowData.employees.length}</Text><View style={s.bulkActionButtons}><Pressable onPress={()=>setWorkflowBulkSelectedEmployees(prev=>Array.from(new Set([...prev,...filteredBulkEmployees.map((r:any)=>employeeNoOf(r))])))} style={s.smallAction}><Text style={s.smallActionText}>تحديد نتائج البحث</Text></Pressable><Pressable onPress={()=>setWorkflowBulkSelectedEmployees(prev=>prev.filter(no=>!filteredBulkEmployees.some((r:any)=>employeeNoOf(r)===no)))} style={s.smallAction}><Text style={s.smallActionText}>إلغاء نتائج البحث</Text></Pressable><Pressable onPress={()=>setWorkflowBulkSelectedEmployees([])} style={s.smallAction}><Text style={s.smallActionText}>إلغاء الكل</Text></Pressable></View></View>
        <ScrollView nestedScrollEnabled style={s.bulkEmployeeList} keyboardShouldPersistTaps="handled">{filteredBulkEmployees.map((r:any)=>{const no=employeeNoOf(r);const checked=workflowBulkSelectedEmployees.includes(no);return <Pressable key={no} onPress={()=>setWorkflowBulkSelectedEmployees(prev=>checked?prev.filter(x=>x!==no):[...prev,no])} style={s.bulkEmployeeRow}><View style={[s.checkboxBox,checked&&s.checkboxBoxActive]}><Text style={s.checkboxMark}>{checked?"✓":""}</Text></View><View style={{flex:1}}><Text style={s.dropdownOptionText}>{employeeNameOf(r)}</Text><Text style={s.smallMuted}>{no} | {String(pick(r,["branch_name"],"الفرع غير محدد"))}</Text></View></Pressable>;})}{!filteredBulkEmployees.length&&<Text style={s.empty}>لا توجد نتائج مطابقة.</Text>}</ScrollView>
        <Btn title={`حفظ تعيين ${workflowBulkSelectedEmployees.length} موظفاً للمدير`} disabled={busy||!workflowBulkSelectedEmployees.length||!workflowBulkManager} onPress={saveBulkWorkflowAssignments}/>
      </View>
      <View style={s.card}><Text style={s.title}>3. إدارة المديرين المباشرين</Text><Text style={s.sub}>اختر موظفاً من نتائج البحث أعلاه ثم أضف أو أزل عنه دور المدير المباشر. لا يمكن إزالة مدير لديه موظفون مرتبطون بتعيين نشط.</Text>
        {workflowSelectedEmployee&&<><Text style={s.body}>{employeeNameOf(workflowSelectedEmployee)} — {employeeNoOf(workflowSelectedEmployee)}</Text><Text style={s.status}>{managerNumbers.has(employeeNoOf(workflowSelectedEmployee))?"لديه حالياً دور مدير مباشر":"ليس لديه دور مدير مباشر"}</Text><Btn title={managerNumbers.has(employeeNoOf(workflowSelectedEmployee))?"إزالة دور المدير المباشر":"إضافة دور المدير المباشر"} secondary={!managerNumbers.has(employeeNoOf(workflowSelectedEmployee))} disabled={busy} onPress={()=>changeManagerRole(workflowSelectedEmployee,!managerNumbers.has(employeeNoOf(workflowSelectedEmployee)))}/></>}
        <Text style={s.sectionTitle}>المديرون المعتمدون حالياً</Text>
        {workflowData.managers.map((m:any)=><View key={employeeNoOf(m)} style={s.responseCard}><Text style={s.responseTitle}>{employeeNameOf(m)} — {employeeNoOf(m)}</Text></View>)}
      </View>
      <View style={s.card}><Text style={s.title}>4. مسؤولو الخدمات والمراجعة حسب الفرع</Text><Text style={s.sub}>تغيير مسؤول المرحلة لا يغيّر تسلسل الموافقات: المدير المباشر ← الخدمات الإدارية ← المراجعة.</Text>
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
    {screen!=="login" && screen!=="survey" && screen!=="result" && <BottomNav current={screen} onHome={()=>setScreen("dashboard")} onNotifications={()=>setScreen("notifications")} onSettings={()=>setScreen("settings")}/>}
    {busy && <View pointerEvents="none" style={s.loading}><ActivityIndicator color={C.primary}/></View>}
  </SafeAreaView>;
}

function MainSectionCard({icon,title,badge,text,onPress}:{icon:any;title:string;badge?:number;text:string;onPress:()=>void}){return <Pressable onPress={onPress} style={s.mainSectionCard}><View style={s.mainSectionIcon}><Ionicons name={icon} size={28} color={C.primary}/>{Number(badge||0)>0&&<View style={s.badge}><Text style={s.badgeText}>{Number(badge)>99?"99+":String(badge)}</Text></View>}</View><View style={{flex:1}}><Text style={s.mainSectionTitle}>{title}</Text><Text style={s.mainSectionText}>{text}</Text></View><Ionicons name="chevron-back-outline" size={19} color={C.muted}/></Pressable>}

function ModuleIcon({name}:{name:any}){return <View style={s.moduleIcon}><Ionicons name={name} size={25} color={C.primary}/></View>;}

function BottomNav({current,onHome,onNotifications,onSettings}:{current:string;onHome:()=>void;onNotifications:()=>void;onSettings:()=>void}){
  const item=(name:any,label:string,active:boolean,onPress:()=>void)=><Pressable onPress={onPress} style={s.navItem}>
    <View style={[s.navIcon,active&&s.navIconActive]}><Ionicons name={name} size={23} color={active?"#fff":C.muted}/></View>
    <Text style={[s.navLabel,active&&s.navLabelActive]}>{label}</Text>
  </Pressable>;
  return <View style={s.bottomNav}>{item("notifications-outline","الإشعارات",current==="notifications",onNotifications)}{item("home-outline","الرئيسية",current==="dashboard",onHome)}{item("settings-outline","الإعدادات",current==="settings",onSettings)}</View>;
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
 card:{backgroundColor:"#fff",borderRadius:16,padding:17,marginBottom:15,borderWidth:1,borderColor:"#E7EAF0"},mainGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",marginTop:10},mainSectionCard:{width:"48.5%",minHeight:145,backgroundColor:"#fff",borderWidth:1,borderColor:C.border,borderRadius:16,padding:14,marginBottom:10},mainSectionIcon:{width:54,height:54,borderRadius:27,backgroundColor:C.pale,alignItems:"center",justifyContent:"center",marginBottom:10,alignSelf:"flex-end",position:"relative"},badge:{position:"absolute",top:-5,right:-5,minWidth:22,height:22,paddingHorizontal:5,borderRadius:11,backgroundColor:C.primary,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"#fff"},badgeText:{color:"#fff",fontSize:10,fontWeight:"900"},mainSectionTitle:{fontSize:15,fontWeight:"900",color:C.dark,textAlign:"right"},mainSectionText:{fontSize:10,color:C.muted,textAlign:"right",lineHeight:17,marginTop:4},roleTabs:{flexDirection:"row-reverse",backgroundColor:C.bg,borderRadius:12,padding:4,marginBottom:12},roleTab:{flex:1,paddingVertical:10,borderRadius:9,alignItems:"center"},roleTabActive:{backgroundColor:"#fff",borderWidth:1,borderColor:C.border},roleTabText:{fontSize:12,color:C.muted,fontWeight:"700"},roleTabTextActive:{color:C.primary,fontWeight:"900"},managerHint:{backgroundColor:C.pale,borderRadius:12,padding:13,marginTop:10},title:{fontSize:21,fontWeight:"800",color:C.text,textAlign:"right"},sub:{fontSize:12,color:C.muted,textAlign:"right",marginTop:5,marginBottom:12,lineHeight:20},body:{fontSize:15,color:C.text,textAlign:"right",lineHeight:25,marginVertical:12},field:{marginBottom:14},label:{fontSize:13,fontWeight:"700",color:C.text,textAlign:"right",marginBottom:7},input:{borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:"#fff",padding:11,fontSize:14,color:C.text,minHeight:44},readonly:{marginBottom:13,alignItems:"flex-end"},readonlyText:{fontSize:15,color:C.dark,fontWeight:"700"},chips:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:7},chip:{borderWidth:1,borderColor:C.border,borderRadius:9,padding:9,backgroundColor:"#fff"},chipActive:{backgroundColor:C.primary,borderColor:C.primary},chipText:{fontSize:12,color:C.text},white:{color:"#fff"},btn:{backgroundColor:C.primary,borderRadius:10,paddingVertical:13,alignItems:"center",marginTop:8},btnText:{color:"#fff",fontWeight:"800",fontSize:14},btn2:{backgroundColor:"#fff",borderWidth:1,borderColor:C.border},btnText2:{color:C.dark},moduleHead:{flexDirection:"row",alignItems:"center",gap:10,marginBottom:4},moduleIcon:{width:44,height:44,borderRadius:22,backgroundColor:"#F4F7FB",alignItems:"center",justifyContent:"center"},surveyCard:{borderWidth:1,borderColor:C.border,borderRadius:12,padding:13,marginTop:12},surveyTitle:{fontSize:16,fontWeight:"800",color:C.dark,textAlign:"right"},status:{fontSize:12,color:C.muted,textAlign:"right"},progress:{height:8,backgroundColor:"#E4E8ED",borderRadius:8,overflow:"hidden",marginTop:8},fill:{height:"100%",backgroundColor:C.primary},domain:{fontSize:17,fontWeight:"800",color:C.dark,textAlign:"right",marginVertical:10},qcard:{backgroundColor:"#fff",borderRadius:13,padding:14,marginBottom:11,borderWidth:1,borderColor:"#E7EAF0"},qno:{fontSize:12,fontWeight:"800",color:C.primary,textAlign:"right",marginBottom:6},question:{fontSize:14,fontWeight:"700",color:C.text,textAlign:"right",lineHeight:23,marginBottom:11},scale:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:6},scaleItem:{width:57,minHeight:60,borderWidth:1,borderColor:C.border,borderRadius:8,padding:5,alignItems:"center",justifyContent:"center"},active:{backgroundColor:C.primary,borderColor:C.primary},val:{fontSize:16,fontWeight:"800",color:C.dark},lbl:{fontSize:9,color:C.muted,textAlign:"center",marginTop:3},done:{alignSelf:"center",width:62,height:62,borderRadius:31,backgroundColor:"#E8F6EE",color:C.success,fontSize:42,fontWeight:"800",textAlign:"center",lineHeight:60,marginBottom:12},score:{flexDirection:"row-reverse",justifyContent:"space-between",padding:12,borderBottomWidth:1,borderBottomColor:"#EDF0F3"},scoreTitle:{color:C.text,fontSize:13},scoreVal:{fontWeight:"800",color:C.dark},total:{backgroundColor:C.pale,borderBottomWidth:0,marginTop:5,borderRadius:8},sectionTitle:{fontSize:16,fontWeight:"800",color:C.dark,textAlign:"right",marginTop:20,marginBottom:10},barWrap:{marginBottom:12},barHead:{flexDirection:"row-reverse",justifyContent:"space-between",marginBottom:5},barTitle:{fontSize:12,color:C.text,fontWeight:"700"},barValue:{fontSize:12,color:C.dark,fontWeight:"800"},barTrack:{height:10,backgroundColor:"#E8EBEF",borderRadius:8,overflow:"hidden"},barFill:{height:"100%",backgroundColor:C.primary,borderRadius:8},metrics:{flexDirection:"row",gap:10},metric:{flex:1,backgroundColor:C.pale,padding:13,borderRadius:10,alignItems:"center",marginBottom:10},metricValue:{fontSize:21,fontWeight:"800",color:C.dark},metricTitle:{fontSize:11,color:C.muted,marginTop:5},toggle:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",padding:12,backgroundColor:C.bg,borderRadius:9},toggleValue:{fontWeight:"800",color:C.dark},exportRow:{flexDirection:"row-reverse",gap:8,marginBottom:12},exportBtn:{flex:1,padding:12,backgroundColor:C.pale,borderRadius:9,alignItems:"center"},exportText:{fontSize:12,fontWeight:"800",color:C.dark},responseCard:{borderWidth:1,borderColor:C.border,borderRadius:10,padding:12,marginTop:9},responseTitle:{fontWeight:"800",color:C.dark,textAlign:"right"},smallMuted:{fontSize:10,color:C.muted,textAlign:"right"},answerList:{borderTopWidth:1,borderTopColor:C.border,marginTop:10,paddingTop:7},answerLine:{paddingVertical:7,borderBottomWidth:1,borderBottomColor:"#F0F1F3"},answerText:{fontSize:12,color:C.text,textAlign:"right",lineHeight:19},answerValue:{fontSize:12,color:C.dark,fontWeight:"800",textAlign:"left",marginTop:3},empty:{textAlign:"center",color:C.muted,padding:15},selectedPanel:{marginTop:14,padding:12,borderRadius:10,backgroundColor:C.bg},dropdownButton:{minHeight:48,borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:"#fff",padding:12,flexDirection:"row-reverse",alignItems:"center",justifyContent:"space-between",marginBottom:8},dropdownButtonText:{fontSize:13,color:C.text,textAlign:"right",flex:1},dropdownArrow:{color:C.dark,fontWeight:"800",marginLeft:8},dropdownPanel:{borderWidth:1,borderColor:C.border,borderRadius:10,padding:9,backgroundColor:"#FAFBFC",marginBottom:10},dropdownList:{maxHeight:230,marginTop:6},dropdownOption:{paddingVertical:11,paddingHorizontal:8,borderBottomWidth:1,borderBottomColor:"#E9EDF1"},dropdownOptionActive:{backgroundColor:C.pale},dropdownOptionText:{fontSize:13,color:C.text,textAlign:"right"},bulkActions:{marginTop:12,marginBottom:8},bulkActionButtons:{flexDirection:"row-reverse",flexWrap:"wrap",gap:7,marginTop:8},smallAction:{borderWidth:1,borderColor:C.border,borderRadius:8,paddingVertical:7,paddingHorizontal:9,backgroundColor:"#fff"},smallActionText:{fontSize:11,color:C.dark,fontWeight:"700"},bulkEmployeeList:{maxHeight:300,borderWidth:1,borderColor:C.border,borderRadius:10,paddingHorizontal:8,marginTop:5},bulkEmployeeRow:{flexDirection:"row-reverse",alignItems:"center",gap:10,paddingVertical:10,borderBottomWidth:1,borderBottomColor:"#EDF0F3"},checkboxBox:{width:23,height:23,borderRadius:5,borderWidth:1,borderColor:C.border,alignItems:"center",justifyContent:"center",backgroundColor:"#fff"},checkboxBoxActive:{backgroundColor:C.primary,borderColor:C.primary},checkboxMark:{color:"#fff",fontWeight:"900"},loading:{position:"absolute",top:8,right:8,backgroundColor:"#fff",padding:7,borderRadius:20},bottomNav:{position:"absolute",left:0,right:0,bottom:0,height:76,backgroundColor:"#fff",borderTopWidth:1,borderTopColor:C.border,flexDirection:"row-reverse",justifyContent:"space-around",alignItems:"center",paddingBottom:8,shadowOpacity:.08,shadowRadius:8,elevation:10},navItem:{flex:1,alignItems:"center",justifyContent:"center"},navIcon:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center",backgroundColor:"#EEF1F4"},navIconActive:{backgroundColor:C.primary},navLabel:{fontSize:10,color:C.muted,fontWeight:"700",marginTop:3},navLabelActive:{color:C.primary,fontWeight:"800"},noticeRow:{flexDirection:"row-reverse",alignItems:"center",gap:12},noticeIcon:{width:50,height:50,borderRadius:25,backgroundColor:"#F1F3F5",alignItems:"center",justifyContent:"center"},profileHead:{flexDirection:"row-reverse",alignItems:"center",gap:12,marginBottom:10},profileIcon:{width:58,height:58,borderRadius:29,backgroundColor:"#F1F3F5",alignItems:"center",justifyContent:"center"}
});
