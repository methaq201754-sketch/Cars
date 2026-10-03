import React, { useMemo, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Alert,
  Modal, SafeAreaView, StatusBar, Switch, Image
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

import { APP_VERSION, APP_BUILD, COLORS, DEFAULT_PERMISSIONS } from './src/constants/theme';
import { INITIAL_FLEET } from './src/constants/initialData';
import { Vehicle, RequestItem, PermissionSet, Assignment } from './src/types';
import { TODAY, money, exportExcel, exportPdf } from './src/utils/helpers';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const [fleet, setFleet] = useState<Vehicle[]>(INITIAL_FLEET);
  const [stations, setStations] = useState<string[]>(['محطة الزبيدي', 'محطة الشركة', 'محطة نقدي']);
  const [fuelTypes, setFuelTypes] = useState<string[]>(['ديزل', 'بترول']);
  const [oils, setOils] = useState<string[]>(['تويوتا', 'ليكوي مولي', 'ناشيونال']);
  const [batteries, setBatteries] = useState<string[]>(['بطارية 70 أمبير', 'بطارية 100 أمبير']);
  const [parts, setParts] = useState<string[]>(['فلتر زيت', 'فلتر هواء', 'فحمات فرامل']);
  const [tires, setTires] = useState<string[]>(['إطار 12.00R20', 'إطار 215/75R17.5']);
  const [maintenanceItems, setMaintenanceItems] = useState<string[]>(['صيانة عامة', 'كهرباء', 'ميكانيكا']);

  const [prices, setPrices] = useState<Record<string, number>>({
    'ديزل': 1200, 'بترول': 1200, 'تويوتا': 4500, 'ليكوي مولي': 6000,
    'ناشيونال': 4000, 'بطارية 70 أمبير': 65000, 'بطارية 100 أمبير': 85000,
    'فلتر زيت': 8000, 'فلتر هواء': 12000, 'فحمات فرامل': 25000,
    'إطار 12.00R20': 85000, 'إطار 215/75R17.5': 65000,
    'صيانة عامة': 10000, 'كهرباء': 10000, 'ميكانيكا': 10000,
  });

  const [requests, setRequests] = useState<RequestItem[]>([
    { id: 'REQ-1001', vehicleId: '22618', driver: 'عبد الغني علي دحان', type: 'وقود',
      date: '2026-10-01', qty: 50, total: 60000, station: 'محطة الشركة', fuelType: 'ديزل',
      status: 'تم الاعتماد', notes: 'تم التعبئة للرحلة' },
    { id: 'REQ-1002', vehicleId: '36040', driver: 'حافظ عبده محمد النينه', type: 'زيوت',
      date: '2026-10-01', qty: 4, total: 18000, oilType: 'تويوتا', unit: 'دبة',
      prevOdo: 124000, currOdo: 129000, distance: 5000, status: 'قيد المراجعة', notes: 'تغيير زيت دوري' },
  ]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [permissions, setPermissions] = useState<Record<string, PermissionSet>>({});
  const [userTab, setUserTab] = useState('service');
  const [adminTab, setAdminTab] = useState('requests');

  const [serviceTypeModal, setServiceTypeModal] = useState<string | null>(null);
  const [codingModal, setCodingModal] = useState<string | null>(null);
  const [itemEditor, setItemEditor] = useState({ index: -1, value: '' });
  const [newItem, setNewItem] = useState('');

  const [selectedStation, setSelectedStation] = useState(stations[0]);
  const [selectedFuel, setSelectedFuel] = useState(fuelTypes[0]);
  const [selectedOil, setSelectedOil] = useState(oils[0]);
  const [selectedBattery, setSelectedBattery] = useState(batteries[0]);
  const [selectedPart, setSelectedPart] = useState(parts[0]);
  const [selectedTire, setSelectedTire] = useState(tires[0]);
  const [selectedMaintenance, setSelectedMaintenance] = useState(maintenanceItems[0]);
  const [selectedUnit, setSelectedUnit] = useState('دبة');
  const [reqQty, setReqQty] = useState('');
  const [currOdometer, setCurrOdometer] = useState('');
  const [reqNotes, setReqNotes] = useState('');
  const [reqImage, setReqImage] = useState<string | undefined>();

  const [editDriverName, setEditDriverName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reportFrom, setReportFrom] = useState('');
  const [reportTo, setReportTo] = useState('');
  const [reportType, setReportType] = useState('الكل');

  const [assignmentForm, setAssignmentForm] = useState<Assignment>({
    id: '', driver: '', vehicleId: '', startDate: TODAY(), endDate: '', notes: '',
  });

  const getPermission = (vehicleId: string): PermissionSet =>
    permissions[vehicleId] || (DEFAULT_PERMISSIONS as PermissionSet);

  const getNextRequestId = () => {
    const nums = requests.map(r => Number(String(r.id).replace(/\D/g, '')) || 0);
    return `REQ-${Math.max(1000, ...nums) + 1}`;
  };

  const lastOdometer = (vehicleId: string) => {
    const rows = requests.filter(r => r.vehicleId === vehicleId && r.type === 'زيوت' && r.currOdo != null);
    return rows.length ? Number(rows[0].currOdo) || 0 : 0;
  };

  const requestTypes = ['وقود', 'زيوت', 'بطاريات', 'قطع غيار', 'صيانة', 'إطارات'];
  const codingMap: Record<string, string[]> = {
    'المحروقات': fuelTypes, 'الزيوت': oils, 'البطاريات': batteries, 'قطع الغيار': parts,
    'الإطارات': tires, 'المحطات': stations, 'الصيانة': maintenanceItems,
  };
  const codingSetters: Record<string, React.Dispatch<React.SetStateAction<string[]>>> = {
    'المحروقات': setFuelTypes, 'الزيوت': setOils, 'البطاريات': setBatteries,
    'قطع الغيار': setParts, 'الإطارات': setTires, 'المحطات': setStations, 'الصيانة': setMaintenanceItems,
  };

  const handleLogin = () => {
    const u = username.trim(), p = password.trim();
    if (u === 'ميثاق' && p === '111') {
      setCurrentUser({ role: 'admin', name: 'ميثاق' }); setUsername(''); setPassword(''); return;
    }
    const found = fleet.find(v => v.id === u);
    if (found && p === '000') {
      if (found.status === 'موقف') {
        Alert.alert('الحساب موقوف', 'هذه السيارة موقوفة حاليًا وممنوعة من تقديم الطلبات.');
        return;
      }
      setCurrentUser({ role: 'driver', ...found });
      setEditDriverName(found.driver);
      setUsername(''); setPassword('');
      return;
    }
    Alert.alert('خطأ في الدخول', 'اسم المستخدم أو كلمة المرور غير صحيحة');
  };

  const handleLogout = () => {
    setCurrentUser(null); setUserTab('service'); setAdminTab('requests');
  };

  const openImagePicker = () => {
    Alert.alert('إرفاق صورة', 'اختر مصدر الصورة', [
      {
        text: 'الكاميرا',
        onPress: async () => {
          const p = await ImagePicker.requestCameraPermissionsAsync();
          if (!p.granted) { Alert.alert('الصلاحية مطلوبة', 'اسمح للتطبيق باستخدام الكاميرا.'); return; }
          const r = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75
          });
          if (!r.canceled) setReqImage(r.assets[0].uri);
        }
      },
      {
        text: 'المعرض',
        onPress: async () => {
          const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!p.granted) { Alert.alert('الصلاحية مطلوبة', 'اسمح للتطبيق باستخدام الصور.'); return; }
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75
          });
          if (!r.canceled) setReqImage(r.assets[0].uri);
        }
      },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  };

  const currentUnitPrice = () => {
    switch (serviceTypeModal) {
      case 'وقود': return prices[selectedFuel] || 0;
      case 'زيوت': return prices[selectedOil] || 0;
      case 'بطاريات': return prices[selectedBattery] || 0;
      case 'قطع غيار': return prices[selectedPart] || 0;
      case 'إطارات': return prices[selectedTire] || 0;
      case 'صيانة': return prices[selectedMaintenance] || 0;
      default: return 0;
    }
  };

  const submitRequest = () => {
    if (!currentUser || !serviceTypeModal) return;
    const permissionKey: Record<string, keyof PermissionSet> = {
      'وقود': 'fuel', 'زيوت': 'oils', 'بطاريات': 'batteries',
      'قطع غيار': 'parts', 'صيانة': 'maintenance', 'إطارات': 'tires',
    };
    if (!getPermission(currentUser.id)[permissionKey[serviceTypeModal]]) {
      Alert.alert('غير مسموح', 'لا توجد صلاحية لتقديم هذا النوع من الطلبات.');
      return;
    }

    const qty = Number(reqQty);
    if (!qty || qty <= 0) { Alert.alert('تنبيه', 'يرجى إدخال كمية صحيحة.'); return; }

    if (serviceTypeModal === 'زيوت' &&
        (!currOdometer || Number(currOdometer) < lastOdometer(currentUser.id))) {
      Alert.alert('العداد', 'العداد الحالي يجب أن يكون أكبر من أو مساويًا للعداد السابق.');
      return;
    }

    const unitPrice = currentUnitPrice();
    const previous = lastOdometer(currentUser.id);
    const curr = Number(currOdometer) || previous;

    const item: RequestItem = {
      id: getNextRequestId(), vehicleId: currentUser.id, driver: currentUser.driver,
      type: serviceTypeModal, date: TODAY(), qty, total: qty * unitPrice,
      status: 'قيد المراجعة', notes: reqNotes, imageUri: reqImage,
    };

    if (serviceTypeModal === 'وقود') { item.station = selectedStation; item.fuelType = selectedFuel; }
    if (serviceTypeModal === 'زيوت') {
      item.oilType = selectedOil; item.unit = selectedUnit;
      item.prevOdo = previous; item.currOdo = curr; item.distance = curr - previous;
    }
    if (serviceTypeModal === 'بطاريات') item.itemName = selectedBattery;
    if (serviceTypeModal === 'قطع غيار') item.itemName = selectedPart;
    if (serviceTypeModal === 'إطارات') item.itemName = selectedTire;
    if (serviceTypeModal === 'صيانة') item.itemName = selectedMaintenance;

    setRequests(prev => [item, ...prev]);
    Alert.alert('تم الإرسال', `تم إرسال طلب ${serviceTypeModal} برقم العملية ${item.id}.`);
    setServiceTypeModal(null);
    setReqQty(''); setCurrOdometer(''); setReqNotes(''); setReqImage(undefined);
  };

  const updateRequestStatus = (id: string, status: string) =>
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));

  const saveCodingItem = () => {
    if (!codingModal || !newItem.trim()) return;
    const setter = codingSetters[codingModal];
    const list = codingMap[codingModal];
    const value = newItem.trim();

    if (itemEditor.index >= 0) {
      const oldValue = list[itemEditor.index];
      setter(prev => prev.map((x, i) => i === itemEditor.index ? value : x));
      if (prices[oldValue] != null) {
        setPrices(prev => {
          const next = { ...prev, [value]: prev[oldValue] };
          delete next[oldValue];
          return next;
        });
      }
    } else if (!list.includes(value)) {
      setter(prev => [...prev, value]);
      if (codingModal !== 'المحطات' && prices[value] == null) {
        setPrices(prev => ({ ...prev, [value]: 0 }));
      }
    }

    setNewItem('');
    setItemEditor({ index: -1, value: '' });
  };

  const deleteCodingItem = (category: string, index: number) => {
    Alert.alert('تأكيد الحذف', 'هل تريد حذف هذا التكويد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف', style: 'destructive',
        onPress: () => codingSetters[category](prev => prev.filter((_, i) => i !== index))
      },
    ]);
  };

  const setPermission = (vehicleId: string, key: keyof PermissionSet, value: boolean) =>
    setPermissions(prev => ({ ...prev, [vehicleId]: { ...getPermission(vehicleId), [key]: value } }));

  const filteredRequests = useMemo(() => requests.filter(r => {
    const dateOk = (!reportFrom || r.date >= reportFrom) && (!reportTo || r.date <= reportTo);
    const typeOk = reportType === 'الكل' || r.type === reportType;
    return dateOk && typeOk;
  }), [requests, reportFrom, reportTo, reportType]);

  const renderSelect = (
    label: string, value: string, values: string[], onChange: (v: string) => void
  ) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choiceRow}>
        {values.map(v => (
          <TouchableOpacity key={v}
            style={[styles.choice, value === v && styles.choiceActive]}
            onPress={() => onChange(v)}>
            <Text style={[styles.choiceText, value === v && styles.choiceTextActive]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderCoding = () => (
    <View>
      <Text style={styles.sectionTitle}>التكويدات</Text>
      <Text style={styles.helper}>إضافة وتعديل وحذف عناصر التكويد المستخدمة في نماذج الطلبات.</Text>

      {Object.keys(codingMap).map(category => (
        <TouchableOpacity key={category} style={styles.menuCard}
          onPress={() => setCodingModal(category)}>
          <View style={styles.menuIcon}><Text style={{fontSize:23}}>▦</Text></View>
          <View style={{flex:1}}>
            <Text style={styles.menuTitle}>تكويد {category}</Text>
            <Text style={styles.menuSub}>{codingMap[category].length} عنصر</Text>
          </View>
          <Text style={styles.chevron}>‹</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.menuCard} onPress={() => setAdminTab('pricing')}>
        <View style={styles.menuIcon}><Text style={{fontSize:20}}>﷼</Text></View>
        <View style={{flex:1}}>
          <Text style={styles.menuTitle}>إدارة الأسعار</Text>
          <Text style={styles.menuSub}>تحديث أسعار الخدمات والمواد</Text>
        </View>
        <Text style={styles.chevron}>‹</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPricing = () => (
    <View>
      <View style={styles.pageHeaderRow}>
        <TouchableOpacity onPress={() => setAdminTab('coding')}>
          <Text style={styles.backText}>رجوع</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>إدارة الأسعار</Text>
      </View>

      {Object.keys(prices).map(key => (
        <View key={key} style={[styles.card,{flexDirection:'row-reverse',alignItems:'center'}]}>
          <View style={{flex:1}}>
            <Text style={styles.cardTitle}>{key}</Text>
            <Text style={styles.cardText}>السعر الحالي: {money(prices[key])}</Text>
          </View>
          <TextInput style={styles.priceInput} keyboardType="numeric"
            value={String(prices[key])}
            onChangeText={v => setPrices(p => ({
              ...p, [key]: Number(v.replace(/[^0-9.]/g,'')) || 0
            }))} />
        </View>
      ))}
    </View>
  );

  const renderRequestsAdmin = () => (
    <View>
      <Text style={styles.sectionTitle}>طلبات السائقين</Text>
      {requests.map(req => (
        <View key={req.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardId}>{req.id}</Text>
            <Text style={styles.badge}>{req.status}</Text>
          </View>
          <Text style={styles.cardTitle}>{req.type} — سيارة {req.vehicleId}</Text>
          <Text style={styles.cardText}>السائق: {req.driver}</Text>
          <Text style={styles.cardText}>التاريخ: {req.date} | الكمية: {req.qty}</Text>
          <Text style={styles.cardText}>التكلفة: {money(req.total)}</Text>
          {req.station ? <Text style={styles.cardText}>المحطة: {req.station} | الوقود: {req.fuelType}</Text> : null}
          {req.oilType ? <Text style={styles.cardText}>
            الزيت: {req.oilType} | العداد: {req.prevOdo} ← {req.currOdo} | المسافة: {req.distance}
          </Text> : null}
          {req.imageUri ? <Image source={{uri:req.imageUri}} style={styles.thumb} /> : null}
          {req.status === 'قيد المراجعة' ? (
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn,{backgroundColor:COLORS.success}]}
                onPress={() => updateRequestStatus(req.id,'تم الاعتماد')}>
                <Text style={styles.btnText}>اعتماد</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn,{backgroundColor:COLORS.danger}]}
                onPress={() => updateRequestStatus(req.id,'مرفوض')}>
                <Text style={styles.btnText}>رفض</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );

  const renderFleet = () => (
    <View>
      <Text style={styles.sectionTitle}>إدارة السيارات ({fleet.length})</Text>
      {fleet.map(v => (
        <View key={v.id} style={styles.card}>
          <Text style={styles.cardTitle}>{v.name}</Text>
          <Text style={styles.cardText}>رقم السيارة: {v.id}</Text>
          <Text style={styles.cardText}>السائق: {v.driver}</Text>
          <Text style={styles.cardText}>النوع: {v.type} | الوقود: {v.fuelType}</Text>
          <TouchableOpacity
            style={[styles.statusBtn,{backgroundColor:v.status==='في الخدمة'?COLORS.danger:COLORS.success}]}
            onPress={() => setFleet(prev => prev.map(x => x.id===v.id
              ? {...x,status:x.status==='في الخدمة'?'موقف':'في الخدمة'} : x))}>
            <Text style={styles.btnText}>{v.status==='في الخدمة'?'إيقاف السيارة':'تنشيط السيارة'}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderAssignments = () => (
    <View>
      <Text style={styles.sectionTitle}>ربط السائقين بالسيارات</Text>
      {renderSelect('السائق',assignmentForm.driver,fleet.map(v=>v.driver),
        v=>setAssignmentForm(f=>({...f,driver:v})))}
      {renderSelect('السيارة',assignmentForm.vehicleId,fleet.map(v=>v.id),
        v=>setAssignmentForm(f=>({...f,vehicleId:v})))}

      <Text style={styles.label}>تاريخ بداية الربط</Text>
      <TextInput style={styles.input} value={assignmentForm.startDate}
        onChangeText={v=>setAssignmentForm(f=>({...f,startDate:v}))}
        placeholder="YYYY-MM-DD" textAlign="right" />

      <Text style={styles.label}>تاريخ نهاية الربط</Text>
      <TextInput style={styles.input} value={assignmentForm.endDate}
        onChangeText={v=>setAssignmentForm(f=>({...f,endDate:v}))}
        placeholder="YYYY-MM-DD" textAlign="right" />

      <Text style={styles.label}>ملاحظات</Text>
      <TextInput style={styles.input} value={assignmentForm.notes}
        onChangeText={v=>setAssignmentForm(f=>({...f,notes:v}))} textAlign="right" />

      <TouchableOpacity style={styles.primaryBtn} onPress={() => {
        if(!assignmentForm.driver || !assignmentForm.vehicleId) {
          Alert.alert('تنبيه','اختر السائق والسيارة.'); return;
        }
        const item = {...assignmentForm,id:`ASN-${Date.now()}`};
        setAssignments(p=>[item,...p]);
        setAssignmentForm({id:'',driver:'',vehicleId:'',startDate:TODAY(),endDate:'',notes:''});
        Alert.alert('تم الحفظ','تم ربط السائق بالسيارة.');
      }}>
        <Text style={styles.btnText}>حفظ الربط</Text>
      </TouchableOpacity>

      {assignments.map(a=>(
        <View key={a.id} style={styles.card}>
          <Text style={styles.cardTitle}>{a.driver} ← سيارة {a.vehicleId}</Text>
          <Text style={styles.cardText}>من {a.startDate} إلى {a.endDate || 'مفتوح'}</Text>
          <Text style={styles.cardText}>{a.notes}</Text>
          <TouchableOpacity onPress={()=>setAssignments(p=>p.filter(x=>x.id!==a.id))}>
            <Text style={styles.deleteText}>حذف الربط</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );

  const renderPermissions = () => (
    <View>
      <Text style={styles.sectionTitle}>الصلاحيات</Text>
      {fleet.map(v => {
        const p=getPermission(v.id);
        const keys: [keyof PermissionSet,string][] = [
          ['addVehicle','إضافة سيارة'],['editVehicle','تعديل بيانات سيارة'],
          ['assignVehicle','ربط سيارة بسائق'],['changePassword','تغيير كلمة المرور'],
          ['reports','استعراض التقارير'],['requestService','طلب خدمة'],
          ['fuel','طلبات المحروقات'],['oils','طلبات الزيوت'],['batteries','طلبات البطاريات'],
          ['parts','طلبات قطع الغيار'],['maintenance','طلبات الصيانة'],['tires','طلبات الإطارات'],
        ];
        return (
          <View key={v.id} style={styles.card}>
            <Text style={styles.cardTitle}>{v.driver} — {v.id}</Text>
            {keys.map(([key,label])=>(
              <View key={String(key)} style={styles.switchRow}>
                <Switch value={p[key]}
                  onValueChange={value=>setPermission(v.id,key,value)}
                  trackColor={{false:'#CBD5E1',true:COLORS.primary}} />
                <Text style={styles.switchLabel}>{label}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );

  const renderReports = (isAdmin: boolean) => {
    const rows = isAdmin ? filteredRequests : filteredRequests.filter(r=>r.vehicleId===currentUser.id);
    const total = rows.reduce((s,r)=>s+r.total,0);

    return (
      <View>
        <Text style={styles.sectionTitle}>{isAdmin?'التقارير العامة':'تقارير ومصاريف السيارة'}</Text>

        <Text style={styles.label}>من تاريخ</Text>
        <TextInput style={styles.input} value={reportFrom} onChangeText={setReportFrom}
          placeholder="YYYY-MM-DD" textAlign="right" />
        <Text style={styles.label}>إلى تاريخ</Text>
        <TextInput style={styles.input} value={reportTo} onChangeText={setReportTo}
          placeholder="YYYY-MM-DD" textAlign="right" />
        {renderSelect('نوع التقرير',reportType,['الكل',...requestTypes],setReportType)}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>إجمالي المصاريف والطلبات</Text>
          <Text style={styles.summaryValue}>{money(total)}</Text>
          <Text style={styles.summarySub}>{rows.length} عملية</Text>
        </View>

        {isAdmin ? requestTypes.map(t=>{
          const rr=rows.filter(r=>r.type===t);
          return <View key={t} style={styles.reportRow}>
            <Text style={styles.cardText}>{t}</Text>
            <Text style={{fontWeight:'800'}}>{money(rr.reduce((s,r)=>s+r.total,0))} ({rr.length})</Text>
          </View>;
        }) : null}

        {rows.map(r=>(
          <View key={r.id} style={styles.card}>
            <Text style={styles.cardId}>{r.id} — {r.type}</Text>
            <Text style={styles.cardText}>التاريخ: {r.date}</Text>
            <Text style={styles.cardText}>الكمية: {r.qty} | التكلفة: {money(r.total)}</Text>
          </View>
        ))}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.exportBtn,{backgroundColor:COLORS.success}]}
            onPress={()=>exportExcel(rows,isAdmin?'admin-report':'my-report')}>
            <Text style={styles.btnText}>تصدير Excel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn,{backgroundColor:COLORS.primary}]}
            onPress={()=>exportPdf(rows,isAdmin?'التقرير العام':'تقرير مصاريف السيارة')}>
            <Text style={styles.btnText}>تصدير PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRequestModal = () => {
    if (!serviceTypeModal) return null;
    const price=currentUnitPrice();
    const qty=Number(reqQty)||0;
    const prev=lastOdometer(currentUser?.id||'');

    return (
      <Modal visible animationType="slide" transparent onRequestClose={()=>setServiceTypeModal(null)}>
        <View style={styles.modalOverlay}>
          <ScrollView contentContainerStyle={styles.modalCenter}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>طلب {serviceTypeModal}</Text>

              <View style={styles.infoPill}>
                <Text style={styles.infoPillText}>رقم العملية: {getNextRequestId()}</Text>
                <Text style={styles.infoPillText}>التاريخ: {TODAY()}</Text>
              </View>

              {serviceTypeModal==='وقود' ? <>
                {renderSelect('المحطة',selectedStation,stations,setSelectedStation)}
                {renderSelect('نوع الوقود',selectedFuel,fuelTypes,setSelectedFuel)}
                <Text style={styles.label}>سعر اللتر</Text>
                <TextInput style={styles.input} value={String(price)} editable={false} textAlign="right" />
              </> : null}

              {serviceTypeModal==='زيوت' ? <>
                {renderSelect('نوع الزيت',selectedOil,oils,setSelectedOil)}
                {renderSelect('الوحدة',selectedUnit,['دبة','علبة','جالون'],setSelectedUnit)}
                <Text style={styles.label}>العداد السابق</Text>
                <TextInput style={styles.input} value={String(prev)} editable={false} textAlign="right" />
                <Text style={styles.label}>العداد الحالي</Text>
                <TextInput style={styles.input} keyboardType="numeric"
                  value={currOdometer} onChangeText={setCurrOdometer} textAlign="right" />
                <Text style={styles.calcText}>
                  المسافة المقطوعة: {Math.max(0,(Number(currOdometer)||prev)-prev).toLocaleString()} كم
                </Text>
              </> : null}

              {serviceTypeModal==='بطاريات' ? renderSelect('نوع البطارية',selectedBattery,batteries,setSelectedBattery) : null}
              {serviceTypeModal==='قطع غيار' ? renderSelect('قطعة الغيار',selectedPart,parts,setSelectedPart) : null}
              {serviceTypeModal==='إطارات' ? renderSelect('نوع الإطار',selectedTire,tires,setSelectedTire) : null}
              {serviceTypeModal==='صيانة' ? renderSelect('نوع الصيانة',selectedMaintenance,maintenanceItems,setSelectedMaintenance) : null}

              <Text style={styles.label}>الكمية</Text>
              <TextInput style={styles.input} keyboardType="numeric" value={reqQty}
                onChangeText={setReqQty} placeholder="أدخل الكمية" textAlign="right" />

              <Text style={styles.totalText}>الإجمالي: {money(qty*price)}</Text>

              <Text style={styles.label}>الملاحظات</Text>
              <TextInput style={[styles.input,{minHeight:70}]} value={reqNotes}
                onChangeText={setReqNotes} multiline textAlign="right" placeholder="ملاحظات الطلب" />

              <TouchableOpacity style={styles.secondaryBtn} onPress={openImagePicker}>
                <Text style={styles.btnText}>📷 إرفاق صورة الفاتورة / العداد</Text>
              </TouchableOpacity>

              {reqImage ? <Image source={{uri:reqImage}} style={styles.previewImage} /> : null}

              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn,{backgroundColor:COLORS.primary}]}
                  onPress={submitRequest}><Text style={styles.btnText}>إرسال الطلب</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn,{backgroundColor:'#64748B'}]}
                  onPress={()=>setServiceTypeModal(null)}><Text style={styles.btnText}>إلغاء</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    );
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.loginContainer}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginCard}>
          <View style={styles.logoCircle}><Text style={styles.logoText}>م</Text></View>
          <Text style={styles.loginTitle}>إدارة السيارات</Text>
          <Text style={styles.loginSubtitle}>تسجيل الدخول ({APP_VERSION})</Text>
          <TextInput style={styles.input} placeholder="رقم السيارة / اسم المستخدم"
            placeholderTextColor="#94A3B8" value={username} onChangeText={setUsername} textAlign="right" />
          <TextInput style={styles.input} placeholder="كلمة المرور"
            placeholderTextColor="#94A3B8" secureTextEntry value={password} onChangeText={setPassword} textAlign="right" />
          <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
            <Text style={styles.btnText}>دخول</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (currentUser.role === 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.topHeader}>
          <View>
            <Text style={styles.headerTitle}>لوحة المسؤول</Text>
            <Text style={styles.headerSub}>مرحباً، {currentUser.name} | الإصدار {APP_VERSION} ({APP_BUILD})</Text>
          </View>
          <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>م</Text></View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={styles.adminNav} contentContainerStyle={{flexDirection:'row-reverse'}}>
          {[
            ['requests','الطلبات'],['coding','التكويدات'],['pricing','الأسعار'],
            ['fleet','السيارات'],['assignments','الربط'],['permissions','الصلاحيات'],['reports','التقارير']
          ].map(([key,label])=>(
            <TouchableOpacity key={key} onPress={()=>setAdminTab(key)}
              style={[styles.adminTab,adminTab===key&&styles.adminTabActive]}>
              <Text style={[styles.adminTabText,adminTab===key&&styles.adminTabTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.content} contentContainerStyle={{paddingBottom:30}}>
          {adminTab==='requests'?renderRequestsAdmin():null}
          {adminTab==='coding'?renderCoding():null}
          {adminTab==='pricing'?renderPricing():null}
          {adminTab==='fleet'?renderFleet():null}
          {adminTab==='assignments'?renderAssignments():null}
          {adminTab==='permissions'?renderPermissions():null}
          {adminTab==='reports'?renderReports(true):null}
        </ScrollView>

        <TouchableOpacity style={styles.logoutBar} onPress={handleLogout}>
          <Text style={styles.btnText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <Modal visible={!!codingModal} transparent animationType="slide"
          onRequestClose={()=>setCodingModal(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>تكويد {codingModal}</Text>
              <TextInput style={styles.input} value={newItem} onChangeText={setNewItem}
                placeholder="اسم العنصر" textAlign="right" />

              <TouchableOpacity style={styles.primaryBtn} onPress={saveCodingItem}>
                <Text style={styles.btnText}>{itemEditor.index>=0?'حفظ التعديل':'إضافة عنصر'}</Text>
              </TouchableOpacity>

              <ScrollView style={{maxHeight:320}}>
                {codingModal ? codingMap[codingModal].map((item,index)=>(
                  <View key={`${item}-${index}`} style={styles.inlineRow}>
                    <Text style={{flex:1,textAlign:'right'}}>{item}</Text>
                    <TouchableOpacity onPress={()=>{
                      setNewItem(item); setItemEditor({index,value:item});
                    }}>
                      <Text style={styles.editText}>تعديل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={()=>deleteCodingItem(codingModal,index)}>
                      <Text style={styles.deleteText}>حذف</Text>
                    </TouchableOpacity>
                  </View>
                )) : null}
              </ScrollView>

              <TouchableOpacity style={styles.secondaryBtn} onPress={()=>{
                setCodingModal(null); setItemEditor({index:-1,value:''}); setNewItem('');
              }}>
                <Text style={styles.btnText}>إغلاق</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topHeader}>
        <View>
          <Text style={styles.headerTitle}>السيارة {currentUser.id}</Text>
          <Text style={styles.headerSub}>{currentUser.driver} | الإصدار {APP_VERSION}</Text>
        </View>
        <View style={styles.headerAvatar}><Text style={styles.headerAvatarText}>🚗</Text></View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{paddingBottom:30}}>
        {userTab==='service' ? (
          <View>
            <Text style={styles.sectionTitle}>الخدمات والطلبات</Text>
            {requestTypes.map((type,index)=>(
              <TouchableOpacity key={type} style={styles.serviceCard}
                onPress={()=>setServiceTypeModal(type)}>
                <View style={styles.serviceIcon}>
                  <Text style={{fontSize:25}}>{['⛽','🛢️','🔋','🔧','🛠️','🛞'][index]}</Text>
                </View>
                <View style={{flex:1}}>
                  <Text style={styles.serviceTitle}>طلب {type}</Text>
                  <Text style={styles.serviceSub}>إنشاء طلب جديد وإرفاق المستند</Text>
                </View>
                <Text style={styles.chevron}>‹</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {userTab==='my_requests' ? (
          <View>
            <Text style={styles.sectionTitle}>طلباتي</Text>
            {requests.filter(r=>r.vehicleId===currentUser.id).map(r=>(
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardId}>{r.id}</Text>
                  <Text style={styles.badge}>{r.status}</Text>
                </View>
                <Text style={styles.cardTitle}>{r.type}</Text>
                <Text style={styles.cardText}>التاريخ: {r.date} | الكمية: {r.qty}</Text>
                <Text style={styles.cardText}>التكلفة: {money(r.total)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {userTab==='vehicle_info' ? (
          <View>
            <Text style={styles.sectionTitle}>بيانات السيارة</Text>
            <View style={styles.card}>
              {Object.entries(currentUser).filter(([k])=>k!=='role').map(([k,v])=>(
                <Text key={k} style={styles.infoRow}>{k}: {String(v)}</Text>
              ))}
            </View>
          </View>
        ) : null}

        {userTab==='reports' ? renderReports(false) : null}

        {userTab==='settings' ? (
          <View>
            <Text style={styles.sectionTitle}>إعدادات الحساب</Text>
            <View style={styles.card}>
              <Text style={styles.label}>اسم السائق</Text>
              <TextInput style={styles.input} value={editDriverName}
                onChangeText={setEditDriverName} textAlign="right" />

              <Text style={styles.label}>كلمة المرور الجديدة</Text>
              <TextInput style={styles.input} secureTextEntry value={newPassword}
                onChangeText={setNewPassword} textAlign="right" />

              <TouchableOpacity style={styles.primaryBtn}
                onPress={()=>Alert.alert('تم الحفظ','تم حفظ التعديلات محلياً.')}>
                <Text style={styles.btnText}>حفظ التعديلات</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.logoutBar,{marginTop:10}]}
                onPress={handleLogout}>
                <Text style={styles.btnText}>تسجيل الخروج</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.driverNav}>
        {[
          ['service','الخدمات'],['my_requests','طلباتي'],['vehicle_info','السيارة'],
          ['reports','التقارير'],['settings','الإعدادات']
        ].map(([key,label])=>(
          <TouchableOpacity key={key} style={styles.driverNavItem}
            onPress={()=>setUserTab(key)}>
            <Text style={[styles.driverNavText,userTab===key&&styles.activeNavText]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderRequestModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:COLORS.bg},
  loginContainer:{flex:1,backgroundColor:COLORS.bg,justifyContent:'center',alignItems:'center',padding:20},
  loginCard:{width:'100%',maxWidth:400,backgroundColor:'#fff',borderRadius:24,padding:26,elevation:5,shadowColor:'#000',shadowOpacity:.08,shadowRadius:12},
  logoCircle:{width:72,height:72,borderRadius:36,backgroundColor:COLORS.primary,alignSelf:'center',alignItems:'center',justifyContent:'center',marginBottom:12},
  logoText:{color:'#fff',fontSize:34,fontWeight:'800'},
  loginTitle:{textAlign:'center',fontSize:24,fontWeight:'800',color:COLORS.text},
  loginSubtitle:{textAlign:'center',fontSize:15,color:COLORS.muted,marginBottom:22,marginTop:4},
  input:{backgroundColor:'#F8FAFC',borderWidth:1,borderColor:COLORS.border,borderRadius:12,paddingHorizontal:14,paddingVertical:12,fontSize:15,color:COLORS.text,marginBottom:10},
  primaryBtn:{backgroundColor:COLORS.primary,borderRadius:12,padding:13,alignItems:'center',marginTop:6},
  secondaryBtn:{backgroundColor:COLORS.primaryDark,borderRadius:12,padding:12,alignItems:'center',marginTop:10},
  btnText:{color:'#fff',fontWeight:'800',textAlign:'center'},
  topHeader:{backgroundColor:COLORS.primary,paddingHorizontal:18,paddingVertical:15,flexDirection:'row-reverse',alignItems:'center',gap:12},
  headerAvatar:{width:44,height:44,borderRadius:22,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  headerAvatarText:{color:COLORS.primary,fontSize:20,fontWeight:'800'},
  headerTitle:{color:'#fff',fontSize:19,fontWeight:'800',textAlign:'right'},
  headerSub:{color:'#FDE7E8',fontSize:13,textAlign:'right',marginTop:2},
  adminNav:{backgroundColor:'#fff',maxHeight:58,borderBottomWidth:1,borderBottomColor:COLORS.border},
  adminTab:{paddingHorizontal:15,paddingVertical:17,borderBottomWidth:3,borderBottomColor:'transparent'},
  adminTabActive:{borderBottomColor:COLORS.primary},
  adminTabText:{color:COLORS.muted,fontWeight:'700'},
  adminTabTextActive:{color:COLORS.primary},
  content:{flex:1,padding:15},
  sectionTitle:{fontSize:20,fontWeight:'800',color:COLORS.text,textAlign:'right',marginBottom:8},
  helper:{textAlign:'right',color:COLORS.muted,fontSize:13,marginBottom:12},
  card:{backgroundColor:'#fff',borderRadius:16,padding:15,marginBottom:11,borderWidth:1,borderColor:'#EEF2F7',elevation:1},
  cardHeader:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center',marginBottom:8},
  cardId:{color:COLORS.primary,fontWeight:'800',fontSize:15},
  cardTitle:{textAlign:'right',fontWeight:'800',fontSize:16,color:COLORS.text,marginBottom:5},
  cardText:{textAlign:'right',color:'#475569',marginBottom:4},
  badge:{backgroundColor:'#FFF4E5',color:'#9A5B00',paddingHorizontal:9,paddingVertical:4,borderRadius:10,fontSize:12,fontWeight:'700'},
  actionRow:{flexDirection:'row-reverse',gap:8,marginTop:10},
  actionBtn:{flex:1,borderRadius:10,padding:11,alignItems:'center'},
  statusBtn:{borderRadius:10,padding:10,alignItems:'center',marginTop:8},
  logoutBar:{backgroundColor:'#7F1D1D',padding:13,alignItems:'center'},
  menuCard:{backgroundColor:'#fff',borderRadius:16,padding:14,marginBottom:10,flexDirection:'row-reverse',alignItems:'center',gap:12,borderWidth:1,borderColor:'#EEF2F7'},
  menuIcon:{width:46,height:46,borderRadius:14,backgroundColor:'#FFF1F1',alignItems:'center',justifyContent:'center'},
  menuTitle:{textAlign:'right',fontWeight:'800',fontSize:15,color:COLORS.text},
  menuSub:{textAlign:'right',fontSize:12,color:COLORS.muted,marginTop:3},
  chevron:{fontSize:30,color:COLORS.primary,fontWeight:'300'},
  field:{marginBottom:8},
  label:{textAlign:'right',fontWeight:'700',fontSize:13,color:'#475569',marginBottom:5,marginTop:4},
  choiceRow:{flexDirection:'row-reverse',gap:7,paddingVertical:2},
  choice:{borderWidth:1,borderColor:COLORS.border,borderRadius:10,paddingHorizontal:12,paddingVertical:8,backgroundColor:'#fff'},
  choiceActive:{backgroundColor:'#FFF0F1',borderColor:COLORS.primary},
  choiceText:{color:'#475569',fontSize:13},
  choiceTextActive:{color:COLORS.primary,fontWeight:'800'},
  priceInput:{width:120,borderWidth:1,borderColor:COLORS.border,borderRadius:10,padding:9,textAlign:'right',backgroundColor:'#F8FAFC'},
  pageHeaderRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',marginBottom:5},
  backText:{color:COLORS.primary,fontWeight:'800'},
  summaryCard:{backgroundColor:COLORS.primary,borderRadius:18,padding:18,marginBottom:12},
  summaryTitle:{color:'#FDE7E8',textAlign:'right',fontWeight:'700'},
  summaryValue:{color:'#fff',textAlign:'right',fontSize:26,fontWeight:'900',marginTop:5},
  summarySub:{color:'#FDE7E8',textAlign:'right',marginTop:3},
  reportRow:{backgroundColor:'#fff',padding:12,borderRadius:12,marginBottom:7,flexDirection:'row-reverse',justifyContent:'space-between'},
  exportBtn:{flex:1,borderRadius:10,padding:12,alignItems:'center'},
  switchRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderTopColor:'#F1F5F9',paddingVertical:7},
  switchLabel:{flex:1,textAlign:'right',color:'#334155',marginRight:8},
  inlineRow:{flexDirection:'row-reverse',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#EEF2F7',gap:10},
  editText:{color:'#2563EB',fontWeight:'800'},
  deleteText:{color:COLORS.danger,fontWeight:'800',textAlign:'right',marginTop:5},
  thumb:{width:55,height:55,borderRadius:8,marginTop:8,alignSelf:'flex-end'},
  modalOverlay:{flex:1,backgroundColor:'rgba(15,23,42,.55)',justifyContent:'center'},
  modalCenter:{padding:16,justifyContent:'center'},
  modalContent:{backgroundColor:'#fff',borderRadius:20,padding:18,maxHeight:'92%'},
  modalTitle:{textAlign:'right',fontSize:20,fontWeight:'900',color:COLORS.text,marginBottom:12},
  infoPill:{flexDirection:'row-reverse',justifyContent:'space-between',backgroundColor:'#F8FAFC',borderRadius:10,padding:10,marginBottom:8},
  infoPillText:{color:COLORS.muted,fontSize:12,fontWeight:'700'},
  calcText:{color:COLORS.primary,fontWeight:'800',textAlign:'right',marginBottom:8},
  totalText:{color:COLORS.primary,fontSize:18,fontWeight:'900',textAlign:'right',marginVertical:8},
  previewImage:{width:110,height:110,borderRadius:12,alignSelf:'flex-end',marginVertical:8},
  serviceCard:{backgroundColor:'#fff',borderRadius:18,padding:14,marginBottom:10,flexDirection:'row-reverse',alignItems:'center',gap:12,borderWidth:1,borderColor:'#EEF2F7',elevation:1},
  serviceIcon:{width:55,height:55,borderRadius:17,backgroundColor:'#FFF1F1',alignItems:'center',justifyContent:'center'},
  serviceTitle:{textAlign:'right',fontWeight:'900',fontSize:16,color:COLORS.text},
  serviceSub:{textAlign:'right',color:COLORS.muted,fontSize:12,marginTop:3},
  driverNav:{flexDirection:'row-reverse',backgroundColor:'#fff',borderTopWidth:1,borderTopColor:COLORS.border,paddingVertical:7},
  driverNavItem:{flex:1,alignItems:'center',paddingVertical:7},
  driverNavText:{color:'#64748B',fontSize:12,fontWeight:'600'},
  activeNavText:{color:COLORS.primary,fontWeight:'900'},
  infoRow:{textAlign:'right',paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#EEF2F7',color:'#334155'},
});
