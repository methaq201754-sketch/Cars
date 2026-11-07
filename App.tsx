import React, { useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View, ActivityIndicator
} from "react-native";
import { createClient } from "@supabase/supabase-js";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";

const SUPABASE_URL = "https://gzjkikvvdtjpoxrrwvmi.supabase.co";
// anon public key only. Never place service_role here.
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzkzOTY4OTE5LCJleHAiOjIxMDk1NDQ5MTl9.U6s_ozaKf9QLDU63kg999dipR0jBejibnQHcm55MzSs";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

const avg = (a:number[]) => a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
const dateOpen = (p:Period|null) => !!p && p.is_enabled && (!p.start_at || new Date(p.start_at).getTime() <= Date.now()) && (!p.end_at || new Date(p.end_at).getTime() >= Date.now());
const errText = (e:any) => e?.message || e?.details || "حدث خطأ غير متوقع.";
const escapeCsv = (v:any) => `"${String(v ?? "").replace(/"/g,'""')}"`;

export default function App() {
  const [screen,setScreen] = useState<"login"|"home"|"employee"|"survey"|"result"|"admin">("login");
  const [employeeNo,setEmployeeNo] = useState("");
  const [password,setPassword] = useState("");
  const [employee,setEmployee] = useState<Employee|null>(null);
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

  const login = async () => {
    const no = employeeNo.trim();
    if(!no || !password){Alert.alert("بيانات الدخول","أدخل الرقم الوظيفي وكلمة المرور.");return;}
    // حسب إعداد النظام الحالي، كلمة المرور الأولية تطابق الرقم الوظيفي.
    if(password.trim() !== no){Alert.alert("تعذر الدخول","كلمة المرور غير صحيحة.");return;}
    setBusy(true);
    try {
      const {data,error} = await supabase.rpc("get_survey_employee",{p_employee_number:no});
      if(error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if(!row){Alert.alert("تعذر الدخول","الرقم الوظيفي غير مسجل أو الحساب غير فعال.");return;}
      const emp:Employee = {employee_number:row.employee_number,employee_name:row.employee_name,is_survey_admin:!!row.is_survey_admin};
      setEmployee(emp);
      const list = await loadCatalog();
      if(emp.is_survey_admin){const p=list.find(x=>x.id===adminSurveyId)?.period; setPeriodStart(p?.start_at||""); setPeriodEnd(p?.end_at||""); setPeriodEnabled(!!p?.is_enabled); setScreen("admin"); await loadAdmin(adminSurveyId,emp.employee_number);}
      else setScreen("home");
      if(!list.length) Alert.alert("تنبيه","لم يتم العثور على استبيانات معرفة في قاعدة البيانات.");
    } catch(e:any){Alert.alert("تعذر تسجيل الدخول",errText(e));}
    finally{setBusy(false);}
  };

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

  const reset = () => {setScreen("home");setSelectedSurvey(null);setAnswers({});setReason("");setResult(null);};
  const logout = () => {setEmployee(null);setEmployeeNo("");setPassword("");setCatalog([]);setSelectedSurvey(null);setAdminRows([]);setScreen("login");};

  return <SafeAreaView style={s.safe}><StatusBar barStyle="dark-content"/>
    {screen==="login" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>نظام استبيانات الموظفين</Text><Text style={s.heroSub}>تسجيل الدخول والمشاركة في الاستبيانات المعتمدة</Text></View>
      <View style={s.card}><Text style={s.title}>تسجيل الدخول</Text><Text style={s.sub}>استخدم رقمك الوظيفي. كلمة المرور الحالية هي الرقم الوظيفي نفسه.</Text>
        <Field label="الرقم الوظيفي" value={employeeNo} onChangeText={setEmployeeNo} keyboardType="numeric" placeholder="أدخل الرقم الوظيفي"/>
        <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry placeholder="أدخل كلمة المرور"/>
        <Btn title={busy?"جاري الدخول...":"دخول"} disabled={busy} onPress={login}/>
      </View>
    </ScrollView>}

    {screen==="home" && <ScrollView contentContainerStyle={s.container}>
      <View style={s.hero}><Text style={s.heroTitle}>مرحباً {employee?.employee_name}</Text><Text style={s.heroSub}>الرقم الوظيفي: {employee?.employee_number}</Text></View>
      <View style={s.card}><Text style={s.title}>الاستبيانات المتاحة</Text><Text style={s.sub}>اختر الاستبيان الذي ترغب في المشاركة فيه.</Text>
        {catalog.filter(x=>x.is_active).map(sv=><View key={sv.id} style={s.surveyCard}><Text style={s.surveyTitle}>{sv.survey_name}</Text><Text style={s.sub}>{sv.description||`${sv.questions?.length||0} سؤالاً`}</Text><Text style={s.status}>{dateOpen(sv.period)?"مفتوح للمشاركة":"مغلق حالياً"}</Text><Btn title="فتح الاستبيان" secondary={!dateOpen(sv.period)} onPress={()=>chooseSurvey(sv)}/></View>)}
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
    {busy && <View pointerEvents="none" style={s.loading}><ActivityIndicator color={C.primary}/></View>}
  </SafeAreaView>;
}

function html(v:any){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c] as string));}
function Field(p:any){return <View style={s.field}><Text style={s.label}>{p.label}</Text><TextInput {...p} style={s.input} placeholderTextColor="#9AA3AD" textAlign="right" autoCapitalize="none"/></View>;}
function Choices({label,values,value,onChange}:{label:string;values:string[];value:string;onChange:(v:string)=>void}){return <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.chips}>{values.map(v=><Pressable key={v} onPress={()=>onChange(v)} style={[s.chip,value===v&&s.chipActive]}><Text style={[s.chipText,value===v&&s.white]}>{v}</Text></Pressable>)}</View></View>;}
function Btn({title,onPress,secondary=false,disabled=false}:{title:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){return <Pressable onPress={onPress} disabled={disabled} style={[s.btn,secondary&&s.btn2,disabled&&{opacity:.5}]}><Text style={[s.btnText,secondary&&s.btnText2]}>{title}</Text></Pressable>;}
function Score({title,v,total=false}:{title:string;v:number;total?:boolean}){return <View style={[s.score,total&&s.total]}><Text style={s.scoreTitle}>{title}</Text><Text style={s.scoreVal}>{Number(v||0).toFixed(2)} / 5</Text></View>;}
function Metric({title,value}:{title:string;value:string}){return <View style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.metricTitle}>{title}</Text></View>;}
function AverageBar({title,value}:{title:string;value:number}){const v=Math.max(0,Math.min(5,Number(value)||0));return <View style={s.barWrap}><View style={s.barHead}><Text style={s.barTitle}>{title}</Text><Text style={s.barValue}>{v.toFixed(2)} / 5</Text></View><View style={s.barTrack}><View style={[s.barFill,{width:`${v*20}%`}]}/></View></View>;}

const s=StyleSheet.create({
 safe:{flex:1,backgroundColor:C.bg},container:{padding:16,paddingBottom:40},hero:{backgroundColor:C.primary,borderRadius:18,padding:22,marginBottom:16},heroTitle:{color:"#fff",fontSize:24,fontWeight:"800",textAlign:"right"},heroSub:{color:"#fff",fontSize:13,textAlign:"right",marginTop:8,lineHeight:21},
 card:{backgroundColor:"#fff",borderRadius:16,padding:17,marginBottom:15,borderWidth:1,borderColor:"#E7EAF0"},title:{fontSize:21,fontWeight:"800",color:C.text,textAlign:"right"},sub:{fontSize:12,color:C.muted,textAlign:"right",marginTop:5,marginBottom:12,lineHeight:20},body:{fontSize:15,color:C.text,textAlign:"right",lineHeight:25,marginVertical:12},field:{marginBottom:14},label:{fontSize:13,fontWeight:"700",color:C.text,textAlign:"right",marginBottom:7},input:{borderWidth:1,borderColor:C.border,borderRadius:10,backgroundColor:"#fff",padding:11,fontSize:14,color:C.text,minHeight:44},readonly:{marginBottom:13,alignItems:"flex-end"},readonlyText:{fontSize:15,color:C.dark,fontWeight:"700"},chips:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:7},chip:{borderWidth:1,borderColor:C.border,borderRadius:9,padding:9,backgroundColor:"#fff"},chipActive:{backgroundColor:C.primary,borderColor:C.primary},chipText:{fontSize:12,color:C.text},white:{color:"#fff"},btn:{backgroundColor:C.primary,borderRadius:10,paddingVertical:13,alignItems:"center",marginTop:8},btnText:{color:"#fff",fontWeight:"800",fontSize:14},btn2:{backgroundColor:"#fff",borderWidth:1,borderColor:C.border},btnText2:{color:C.dark},surveyCard:{borderWidth:1,borderColor:C.border,borderRadius:12,padding:13,marginTop:12},surveyTitle:{fontSize:16,fontWeight:"800",color:C.dark,textAlign:"right"},status:{fontSize:12,color:C.muted,textAlign:"right"},progress:{height:8,backgroundColor:"#E4E8ED",borderRadius:8,overflow:"hidden",marginTop:8},fill:{height:"100%",backgroundColor:C.primary},domain:{fontSize:17,fontWeight:"800",color:C.dark,textAlign:"right",marginVertical:10},qcard:{backgroundColor:"#fff",borderRadius:13,padding:14,marginBottom:11,borderWidth:1,borderColor:"#E7EAF0"},qno:{fontSize:12,fontWeight:"800",color:C.primary,textAlign:"right",marginBottom:6},question:{fontSize:14,fontWeight:"700",color:C.text,textAlign:"right",lineHeight:23,marginBottom:11},scale:{flexDirection:"row",flexWrap:"wrap",justifyContent:"flex-end",gap:6},scaleItem:{width:57,minHeight:60,borderWidth:1,borderColor:C.border,borderRadius:8,padding:5,alignItems:"center",justifyContent:"center"},active:{backgroundColor:C.primary,borderColor:C.primary},val:{fontSize:16,fontWeight:"800",color:C.dark},lbl:{fontSize:9,color:C.muted,textAlign:"center",marginTop:3},done:{alignSelf:"center",width:62,height:62,borderRadius:31,backgroundColor:"#E8F6EE",color:C.success,fontSize:42,fontWeight:"800",textAlign:"center",lineHeight:60,marginBottom:12},score:{flexDirection:"row-reverse",justifyContent:"space-between",padding:12,borderBottomWidth:1,borderBottomColor:"#EDF0F3"},scoreTitle:{color:C.text,fontSize:13},scoreVal:{fontWeight:"800",color:C.dark},total:{backgroundColor:C.pale,borderBottomWidth:0,marginTop:5,borderRadius:8},sectionTitle:{fontSize:16,fontWeight:"800",color:C.dark,textAlign:"right",marginTop:20,marginBottom:10},barWrap:{marginBottom:12},barHead:{flexDirection:"row-reverse",justifyContent:"space-between",marginBottom:5},barTitle:{fontSize:12,color:C.text,fontWeight:"700"},barValue:{fontSize:12,color:C.dark,fontWeight:"800"},barTrack:{height:10,backgroundColor:"#E8EBEF",borderRadius:8,overflow:"hidden"},barFill:{height:"100%",backgroundColor:C.primary,borderRadius:8},metrics:{flexDirection:"row",gap:10},metric:{flex:1,backgroundColor:C.pale,padding:13,borderRadius:10,alignItems:"center",marginBottom:10},metricValue:{fontSize:21,fontWeight:"800",color:C.dark},metricTitle:{fontSize:11,color:C.muted,marginTop:5},toggle:{flexDirection:"row-reverse",justifyContent:"space-between",alignItems:"center",padding:12,backgroundColor:C.bg,borderRadius:9},toggleValue:{fontWeight:"800",color:C.dark},exportRow:{flexDirection:"row-reverse",gap:8,marginBottom:12},exportBtn:{flex:1,padding:12,backgroundColor:C.pale,borderRadius:9,alignItems:"center"},exportText:{fontSize:12,fontWeight:"800",color:C.dark},responseCard:{borderWidth:1,borderColor:C.border,borderRadius:10,padding:12,marginTop:9},responseTitle:{fontWeight:"800",color:C.dark,textAlign:"right"},smallMuted:{fontSize:10,color:C.muted,textAlign:"right"},answerList:{borderTopWidth:1,borderTopColor:C.border,marginTop:10,paddingTop:7},answerLine:{paddingVertical:7,borderBottomWidth:1,borderBottomColor:"#F0F1F3"},answerText:{fontSize:12,color:C.text,textAlign:"right",lineHeight:19},answerValue:{fontSize:12,color:C.dark,fontWeight:"800",textAlign:"left",marginTop:3},empty:{textAlign:"center",color:C.muted,padding:15},loading:{position:"absolute",top:8,right:8,backgroundColor:"#fff",padding:7,borderRadius:20}
});
