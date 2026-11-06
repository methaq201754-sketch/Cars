
import React, { useMemo, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text, TextInput, View
} from "react-native";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://gzjkikvvdtjpoxrrwvmi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6amtpa3Z2ZHRqcG94cnJ3dm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5Njg5MTksImV4cCI6MjEwOTU0NDkxOX0.uS6_ozaKf9QLDU63kg999dipR0jBejibnQHcm55MzSs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const C = {
  primary: "#C0272D", dark: "#9E1F24", orange: "#FF7A45",
  bg: "#F4F7FB", text: "#20252B", muted: "#68727D",
  border: "#D9DEE5", success: "#18864B"
};

const DEPARTMENTS = [
  "الموارد البشرية", "التخطيط والمخازن", "الجودة والبحث والتطوير",
  "الصيانة", "المبيعات والتسويق", "الرقابة والمراجعة الداخلية",
  "الصفيح", "المالية", "إنتاج الطلاء", "إنتاج الجاما"
];

const GRADES = [
  "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة",
  "السادسة", "السابعة", "الثامنة", "التاسعة"
];

const QUALIFICATIONS = [
  "تعليم أساسي", "ثانوية عامة", "دبلوم", "جامعي"
];

const QUESTIONS = [
  [1,1,"مقدار الراتب الممنوح لك مقارنة بحجم العمل الذي تقوم به."],
  [2,1,"مقدار الراتب الذي تتقاضاه مقارنة بالسوق المحلي."],
  [3,1,"انتظام موعد الراتب الشهري."],
  [4,1,"المزايا التي تقدمها الشركة مناسبة مقارنة بالسوق المحلي (اجازات-حوافز-سلف-بدلات وغيرها)."],
  [5,1,"النموذج الحالي المستخدم لتقييم الأداء يعتبر مناسباً لوظيفتك."],
  [6,1,"يقوم رئيسك المباشر بمناقشة أدائك أثناء عملية التقييم."],
  [7,1,"نتيجة تقييم الأداء الخاصة بك تعكس فعلياً حقيقة أدائك في العمل."],
  [8,1,"مكافأة عيد العمال السنوية مرضية لك."],
  [9,1,"تكريم العاملين المتميزين يمثل حافزاً معنوياً لزيادة إنتاجيتك."],
  [10,1,"تكريم العاملين ذوي الخدمة الطويلة مرضٍ لك."],
  [11,2,"مدى الاحترام والشفافية والعدالة التي يتعامل بها رئيسك المباشر."],
  [12,2,"رئيسك المباشر يقوم بتطوير أدائك ويزيد من خبرتك العملية."],
  [13,2,"مفهوم العمل كفريق واحد في الشركة واضح ومطبق."],
  [14,2,"مدى التحفيز غير المادي من قبل رئيسك المباشر."],
  [15,2,"مدى علاقتك بزملائك في العمل."],
  [16,2,"مدى تقدير ومساعدة زملائك لك عند زيادة حجم العمل."],
  [17,2,"مدى علاقتك بزملاء في الإدارات والأقسام الأخرى."],
  [18,2,"الفرص التدريبية المتاحة لك في مجال عملك."],
  [19,2,"مدى العدالة في توزيع أعباء العمل بين الموظفين في قسمك أو إدارتك."],
  [20,2,"مدى إيجابية الإدارة في التعامل مع شكاوى الموظفين."],
  [21,2,"مدى إيجابية الإدارة في التعامل مع مقترحاتك."],
  [22,2,"مدى دعم ومساندة الإدارة عند الحاجة."],
  [23,2,"توفير الصلاحيات الكافية للقيام بمهام وظيفتك."],
  [24,2,"أسلوب الرقابة الذي يتبعه رئيسك لمتابعة أدائك في العمل."],
  [25,2,"سياسة الدوام المتبعة حالياً مناسبة ومرضية لك."],
  [26,3,"المستوى العام للنظافة في الممرات ومناطق العمل."],
  [27,3,"مستوى النظافة في المرافق الصحية (الحمامات)."],
  [28,3,"التهوية في مكان العمل."],
  [29,3,"الإضاءة في مكان العمل."],
  [30,3,"توفير الوسائل التقنية اللازمة لأداء العمل."],
  [31,3,"وسائل السلامة في مكان العمل."],
  [32,3,"العناية الصحية المقدمة."],
  [33,3,"كيف تصف معنوياتك في العمل في هذا الوقت."]
];

const SCALE = [
  [5,"راضي تماماً"],
  [4,"راضي"],
  [3,"محايد"],
  [2,"غير راضي"],
  [1,"غير راضي إطلاقاً"]
];

const average = (a: number[]) =>
  a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

export default function App() {
  const [screen, setScreen] = useState<"intro"|"employee"|"survey"|"result">("intro");

  const [employeeNo, setEmployeeNo] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const [department, setDepartment] = useState("");
  const [grade, setGrade] = useState("");
  const [years, setYears] = useState("");
  const [qualification, setQualification] = useState("");

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const progress = useMemo(
    () => Math.round(Object.keys(answers).length / 33 * 100),
    [answers]
  );

  const validate = () => {
    if (!employeeNo.trim()) return "أدخل الرقم الوظيفي.";
    if (!employeeName) return "تحقق من الرقم الوظيفي أولاً.";
    if (!department) return "اختر القسم.";
    if (!grade) return "اختر الدرجة الوظيفية.";

    const y = Number(years);
    if (!Number.isInteger(y) || y < 1 || y > 30) {
      return "أدخل سنوات خدمة من 1 إلى 30.";
    }

    if (!qualification) return "اختر المؤهل.";
    return null;
  };

  // التحقق من الرقم الوظيفي واسترجاع اسم الموظف
  const start = async () => {
    if (!employeeNo.trim()) {
      Alert.alert("بيانات ناقصة", "أدخل الرقم الوظيفي.");
      return;
    }

    if (!department || !grade || !years || !qualification) {
      Alert.alert("بيانات ناقصة", "أكمل بيانات القسم والدرجة وسنوات الخدمة والمؤهل.");
      return;
    }

    const y = Number(years);
    if (!Number.isInteger(y) || y < 1 || y > 30) {
      Alert.alert("بيانات غير صحيحة", "أدخل سنوات خدمة من 1 إلى 30.");
      return;
    }

    setBusy(true);
    setEmployeeName("");

    try {
      const { data, error } = await supabase.rpc(
        "get_survey_employee",
        {
          p_employee_number: employeeNo.trim()
        }
      );

      if (error) throw error;

      const employee = Array.isArray(data) ? data[0] : data;

      if (!employee || !employee.employee_name) {
        Alert.alert(
          "رقم وظيفي غير مسجل",
          "الرقم الوظيفي غير مسجل أو غير نشط، يرجى مراجعة الموارد البشرية."
        );
        return;
      }

      setEmployeeName(employee.employee_name);

      Alert.alert(
        "تم التحقق من الموظف",
        `مرحباً ${employee.employee_name}، يمكنك الآن متابعة الاستبيان.`,
        [
          {
            text: "متابعة",
            onPress: () => setScreen("survey")
          }
        ]
      );
    } catch (e: any) {
      Alert.alert(
        "تعذر التحقق",
        e?.message || "تعذر الاتصال بقاعدة البيانات."
      );
    } finally {
      setBusy(false);
    }
  };

  // إرسال البيانات والإجابات الـ33 في استدعاء واحد
  const submit = async () => {
    const validationError = validate();

    if (validationError) {
      Alert.alert("بيانات ناقصة", validationError);
      return;
    }

    if (Object.keys(answers).length !== 33) {
      Alert.alert(
        "الاستبيان غير مكتمل",
        `المتبقي ${33 - Object.keys(answers).length} سؤالاً.`
      );
      return;
    }

    setBusy(true);

    try {
      const d1 = average(
        QUESTIONS.filter(q => q[1] === 1)
          .map(q => answers[q[0] as number])
      );

      const d2 = average(
        QUESTIONS.filter(q => q[1] === 2)
          .map(q => answers[q[0] as number])
      );

      const d3 = average(
        QUESTIONS.filter(q => q[1] === 3)
          .map(q => answers[q[0] as number])
      );

      const total = average(
        QUESTIONS.map(q => answers[q[0] as number])
      );

      const answerRows = QUESTIONS.map(q => ({
        question_no: q[0],
        domain_no: q[1],
        answer_value: answers[q[0] as number]
      }));

      const { data, error } = await supabase.rpc(
        "submit_survey_response",
        {
          p_employee_number: employeeNo.trim(),
          p_department: department,
          p_job_grade: grade,
          p_service_years: Number(years),
          p_qualification: qualification,
          p_morale_reason: reason.trim() || null,
          p_answers: answerRows
        }
      );

      if (error) {
        const message = error.message || "";

        if (
          message.includes("ALREADY_SUBMITTED") ||
          message.includes("duplicate key") ||
          message.includes("survey_employee_number_unique")
        ) {
          Alert.alert(
            "تم التسجيل مسبقاً",
            "هذا الرقم الوظيفي لديه استبيان مسجل بالفعل، ولا يمكن المشاركة أكثر من مرة."
          );
          return;
        }

        if (message.includes("EMPLOYEE_NOT_FOUND")) {
          Alert.alert(
            "رقم وظيفي غير مسجل",
            "الرقم الوظيفي غير مسجل أو غير نشط، يرجى مراجعة الموارد البشرية."
          );
          return;
        }

        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error("لم يتم تأكيد حفظ الاستبيان من قاعدة البيانات.");
      }

      setResult({
        d1: data.domain1_average ?? d1,
        d2: data.domain2_average ?? d2,
        d3: data.domain3_average ?? d3,
        total: data.overall_average ?? total
      });

      setScreen("result");

    } catch (e: any) {
      Alert.alert(
        "فشل الحفظ",
        e?.message || "حدث خطأ أثناء حفظ الاستبيان."
      );
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setScreen("intro");
    setEmployeeNo("");
    setEmployeeName("");
    setDepartment("");
    setGrade("");
    setYears("");
    setQualification("");
    setAnswers({});
    setReason("");
    setResult(null);
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />

      {screen === "intro" && (
        <ScrollView contentContainerStyle={s.container}>
          <View style={s.hero}>
            <Text style={s.heroTitle}>استبيان رضا الموظفين</Text>
            <Text style={s.heroSub}>
              قياس مستوى الرضا عن سياسات وإجراءات الخدمات الإدارية
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.greeting}>أخي العامل... أخي الموظف</Text>

            <Text style={s.body}>
              إن المعلومات والبيانات التي ستقدمها لنا من خلال الاستبيان
              ستوضح لنا الصورة التي لا نراها عن سياسات وإجراءات الخدمات الإدارية.
            </Text>

            <Text style={s.body}>
              نأمل منك تحري الدقة والمصداقية في البيانات التي ستقدمها لنا
              من خلال إجابتك على الاستفسارات الواردة في الاستبيان.
            </Text>

            <View style={s.notice}>
              <Text style={s.noticeTitle}>تعليمات</Text>
              <Text style={s.noticeText}>
                اقرأ العبارات جيداً ثم اختر الإجابة التي تعبّر تماماً عن رأيك.
              </Text>
            </View>

            <Btn
              title="ابدأ الاستبيان"
              onPress={() => setScreen("employee")}
            />
          </View>
        </ScrollView>
      )}

      {screen === "employee" && (
        <ScrollView contentContainerStyle={s.container}>
          <View style={s.card}>
            <Text style={s.title}>بيانات الموظف</Text>
            <Text style={s.sub}>
              أدخل رقمك الوظيفي، وسيظهر اسمك تلقائياً بعد التحقق.
            </Text>

            <Field
              label="الرقم الوظيفي"
              value={employeeNo}
              onChangeText={(v: string) => {
                setEmployeeNo(v);
                setEmployeeName("");
              }}
              keyboardType="numeric"
              placeholder="أدخل الرقم الوظيفي"
            />

            {employeeName !== "" && (
              <View style={s.employeeBox}>
                <Text style={s.employeeLabel}>اسم الموظف المسجل</Text>
                <Text style={s.employeeValue}>{employeeName}</Text>
                <Text style={s.employeeVerified}>✓ تم التحقق من الرقم الوظيفي</Text>
              </View>
            )}

            <Choices
              label="القسم"
              values={DEPARTMENTS}
              value={department}
              onChange={setDepartment}
            />

            <Choices
              label="الدرجة الوظيفية"
              values={GRADES}
              value={grade}
              onChange={setGrade}
            />

            <Field
              label="سنوات الخدمة"
              value={years}
              onChangeText={setYears}
              keyboardType="numeric"
              placeholder="من 1 إلى 30"
            />

            <Choices
              label="المؤهل"
              values={QUALIFICATIONS}
              value={qualification}
              onChange={setQualification}
            />

            <Btn
              title={busy ? "جاري التحقق..." : "التحقق والمتابعة"}
              disabled={busy}
              onPress={start}
            />

            <Btn
              title="رجوع"
              secondary
              onPress={() => setScreen("intro")}
            />
          </View>
        </ScrollView>
      )}

      {screen === "survey" && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={s.container}>
            <View style={s.card}>
              <Text style={s.title}>الاستبيان</Text>
              <Text style={s.sub}>
                الموظف: {employeeName}
              </Text>
              <Text style={s.sub}>
                أجبت عن {Object.keys(answers).length} من 33 — {progress}%
              </Text>

              <View style={s.progress}>
                <View style={[s.fill, { width: `${progress}%` }]} />
              </View>
            </View>

            {[1, 2, 3].map(d => (
              <View key={d}>
                <Text style={s.domain}>
                  {d === 1
                    ? "المجال الأول: الراتب والمزايا وتقييم الأداء"
                    : d === 2
                    ? "المجال الثاني: العلاقات والإدارة وبيئة العمل التنظيمية"
                    : "المجال الثالث: بيئة ومرافق العمل والمعنويات"}
                </Text>

                {QUESTIONS.filter(q => q[1] === d).map(q => (
                  <View key={q[0]} style={s.qcard}>
                    <Text style={s.qno}>السؤال {q[0]}</Text>
                    <Text style={s.question}>{q[2]}</Text>

                    <View style={s.scale}>
                      {SCALE.map(x => (
                        <Pressable
                          key={x[0]}
                          onPress={() =>
                            setAnswers(a => ({
                              ...a,
                              [q[0] as number]: x[0] as number
                            }))
                          }
                          style={[
                            s.scaleItem,
                            answers[q[0] as number] === x[0] && s.active
                          ]}
                        >
                          <Text
                            style={[
                              s.val,
                              answers[q[0] as number] === x[0] && s.white
                            ]}
                          >
                            {x[0]}
                          </Text>

                          <Text
                            style={[
                              s.lbl,
                              answers[q[0] as number] === x[0] && s.white
                            ]}
                          >
                            {x[1]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            ))}

            <View style={s.qcard}>
              <Text style={s.qno}>ملاحظة مفتوحة</Text>
              <Text style={s.question}>
                الأسباب التي أثرت على معنوياتك.
              </Text>

              <TextInput
                value={reason}
                onChangeText={setReason}
                multiline
                style={[s.input, { height: 110, textAlignVertical: "top" }]}
                placeholder="اكتب الأسباب إن وجدت..."
              />
            </View>

            <Btn
              title={busy ? "جاري الحفظ..." : "إرسال الاستبيان"}
              disabled={busy}
              onPress={submit}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {screen === "result" && (
        <ScrollView contentContainerStyle={s.container}>
          <View style={s.card}>
            <Text style={s.done}>✓</Text>
            <Text style={s.title}>تم تسجيل الاستبيان بنجاح</Text>

            <Text style={s.body}>
              تم حفظ الإجابات الفردية والأسئلة كاملة، إضافة إلى متوسطات
              المجالات والنتيجة الإجمالية.
            </Text>

            {result && (
              <>
                <Score title="المجال الأول" v={result.d1} />
                <Score title="المجال الثاني" v={result.d2} />
                <Score title="المجال الثالث" v={result.d3} />
                <Score title="النتيجة الإجمالية" v={result.total} total />
              </>
            )}

            <Btn title="إنهاء" onPress={reset} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field(p: any) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{p.label}</Text>
      <TextInput
        {...p}
        style={s.input}
        placeholderTextColor="#9AA3AD"
        textAlign="right"
      />
    </View>
  );
}

function Choices({
  label, values, value, onChange
}: {
  label: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {values.map(v => (
          <Pressable
            key={v}
            onPress={() => onChange(v)}
            style={[s.chip, value === v && s.chipActive]}
          >
            <Text style={[s.chipText, value === v && s.white]}>
              {v}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Btn({
  title, onPress, secondary = false, disabled = false
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.btn,
        secondary && s.btn2,
        disabled && { opacity: 0.5 }
      ]}
    >
      <Text style={[s.btnText, secondary && s.btnText2]}>
        {title}
      </Text>
    </Pressable>
  );
}

function Score({
  title, v, total = false
}: {
  title: string;
  v: number;
  total?: boolean;
}) {
  return (
    <View style={[s.score, total && s.total]}>
      <Text style={s.scoreTitle}>{title}</Text>
      <Text style={s.scoreVal}>{Number(v).toFixed(2)} / 5</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { padding: 16, paddingBottom: 40 },

  hero: {
    backgroundColor: C.primary,
    borderRadius: 18,
    padding: 24,
    marginBottom: 16
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "right"
  },
  heroSub: {
    color: "#fff",
    fontSize: 14,
    textAlign: "right",
    marginTop: 8,
    lineHeight: 22
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E7EAF0"
  },
  greeting: {
    fontSize: 20,
    fontWeight: "800",
    color: C.dark,
    textAlign: "right",
    marginBottom: 12
  },
  body: {
    fontSize: 15,
    color: C.text,
    textAlign: "right",
    lineHeight: 26,
    marginBottom: 10
  },
  notice: {
    backgroundColor: "#FFF5EF",
    borderRightWidth: 4,
    borderRightColor: C.orange,
    padding: 14,
    marginVertical: 8
  },
  noticeTitle: {
    fontWeight: "800",
    color: C.dark,
    textAlign: "right"
  },
  noticeText: {
    color: C.text,
    textAlign: "right",
    lineHeight: 23
  },

  title: {
    fontSize: 23,
    fontWeight: "800",
    color: C.text,
    textAlign: "right"
  },
  sub: {
    fontSize: 13,
    color: C.muted,
    textAlign: "right",
    marginTop: 5,
    marginBottom: 14
  },

  field: { marginBottom: 16 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: C.text,
    textAlign: "right",
    marginBottom: 8
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 12,
    fontSize: 15,
    color: C.text
  },

  employeeBox: {
    backgroundColor: "#E8F6EE",
    borderWidth: 1,
    borderColor: "#B9E2C9",
    borderRadius: 10,
    padding: 13,
    marginBottom: 16
  },
  employeeLabel: {
    fontSize: 12,
    color: C.muted,
    textAlign: "right"
  },
  employeeValue: {
    fontSize: 18,
    fontWeight: "800",
    color: C.dark,
    textAlign: "right",
    marginTop: 5
  },
  employeeVerified: {
    fontSize: 12,
    color: C.success,
    textAlign: "right",
    marginTop: 5
  },

  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 7
  },
  chip: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 9,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.primary
  },
  chipText: { fontSize: 13, color: C.text },

  btn: {
    backgroundColor: C.primary,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 7
  },
  btnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15
  },
  btn2: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: C.border
  },
  btnText2: { color: C.dark },

  progress: {
    height: 8,
    backgroundColor: "#E4E8ED",
    borderRadius: 8,
    overflow: "hidden",
    marginTop: 8
  },
  fill: { height: "100%", backgroundColor: C.primary },

  domain: {
    fontSize: 17,
    fontWeight: "800",
    color: C.dark,
    textAlign: "right",
    marginVertical: 10
  },
  qcard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E7EAF0"
  },
  qno: {
    fontSize: 12,
    fontWeight: "800",
    color: C.primary,
    textAlign: "right",
    marginBottom: 6
  },
  question: {
    fontSize: 15,
    fontWeight: "700",
    color: C.text,
    textAlign: "right",
    lineHeight: 24,
    marginBottom: 12
  },
  scale: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 7
  },
  scaleItem: {
    width: 55,
    minHeight: 62,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 9,
    padding: 5,
    alignItems: "center",
    justifyContent: "center"
  },
  active: {
    backgroundColor: C.primary,
    borderColor: C.primary
  },
  val: {
    fontSize: 16,
    fontWeight: "800",
    color: C.dark
  },
  lbl: {
    fontSize: 9,
    color: C.muted,
    textAlign: "center",
    marginTop: 3
  },
  white: { color: "#fff" },

  done: {
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E8F6EE",
    color: C.success,
    fontSize: 42,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 62,
    marginBottom: 14
  },
  score: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    padding: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF0F3"
  },
  scoreTitle: { color: C.text },
  scoreVal: { fontWeight: "800", color: C.dark },
  total: {
    backgroundColor: "#FFF5EF",
    borderBottomWidth: 0,
    marginTop: 6,
    borderRadius: 8
  }
});
