# 🚀 **Shopify Metafield JSON Editor App**

## 📋 **Proje Özeti**

Bu app, Shopify ürünlerindeki metafield'ları JSON yazmadan, kullanıcı dostu bir arayüzle düzenlemek için geliştirilmiştir. E-commerce ekibi, ürün özelleştirme seçeneklerini (renk, header tipi, grommet, boyut) kolayca yönetebilir.

## ✨ **Özellikler**

- 🎨 **Kullanıcı Dostu Arayüz**: JSON yazmadan metafield düzenleme
- 📝 **Dinamik Form Alanları**: Renk, header, grommet, boyut seçenekleri
- ✅ **Validasyon**: Otomatik form doğrulama ve hata kontrolü
- 🔄 **Gerçek Zamanlı Kaydetme**: Değişiklikleri anında Shopify'a kaydetme
- 📱 **Responsive Tasarım**: Mobil ve masaüstü uyumlu
- 🛡️ **Güvenli**: Shopify Admin API ile güvenli entegrasyon

## 🛠️ **Teknolojiler**

- **Frontend**: React, Remix, Shopify Polaris
- **Backend**: Node.js, Remix
- **API**: Shopify Admin GraphQL API
- **Styling**: Shopify Polaris Design System

## 📁 **Dosya Yapısı**

```
product-customizer-ui/
├── app/
│   ├── components/
│   │   └── MetafieldEditor.jsx      # Ana metafield editör component'i
│   ├── routes/
│   │   ├── app._index.jsx           # Ana sayfa
│   │   ├── products.jsx             # Ürün listesi
│   │   └── products.$id.jsx         # Ürün detay ve metafield düzenleme
│   ├── utils/
│   │   └── metafield.js             # Yardımcı fonksiyonlar
│   ├── shopify.server.js            # Shopify auth & API
│   └── root.jsx                     # App root
├── shopify.app.toml                 # App konfigürasyonu
└── package.json                     # Dependencies
```

## 🚀 **Kurulum ve Çalıştırma**

### **Gereksinimler**
- Node.js 18+ 
- Shopify CLI
- Shopify Partner hesabı

### **Kurulum Adımları**

1. **Projeyi klonlayın**
```bash
git clone <repository-url>
cd product-customizer-ui
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Shopify app'i bağlayın**
```bash
npm run config:link
```

4. **Geliştirme sunucusunu başlatın**
```bash
npm run dev
```

5. **App'i test store'a yükleyin**
```bash
npm run deploy
```

## 📖 **Kullanım Kılavuzu**

### **1. Ana Sayfa**
- App'in genel bilgilerini görüntüler
- "Ürünleri Görüntüle" butonu ile ürün listesine geçiş
- Test ürünü oluşturma özelliği

### **2. Ürün Listesi**
- Mağazanızdaki tüm ürünleri listeler
- Her ürün için durum bilgisi
- "Özelleştirme Seçenekleri" butonu ile düzenleme

### **3. Metafield Editörü**
- **Alan Ekleme**: Yeni özelleştirme alanı ekleme
- **Alan Tipleri**: Renk, Header, Grommet, Boyut, Metin, Sayı, Resim URL
- **Seçenek Yönetimi**: Her alan için seçenek ekleme/silme
- **Validasyon**: Otomatik form doğrulama
- **Kaydetme**: Değişiklikleri Shopify'a kaydetme

### **4. Alan Tipleri ve Özellikleri**

#### **Renk (Color)**
- Önceden tanımlı renk seçenekleri
- Özel renk değerleri ekleme
- Hex kod desteği

#### **Header Tipi**
- Standart, Özel, Minimal seçenekleri
- Özel header tipleri ekleme

#### **Grommet**
- Yuvarlak, Kare, Oval seçenekleri
- Özel grommet tipleri

#### **Boyut**
- Küçük, Orta, Büyük seçenekleri
- Özel boyut değerleri

#### **Metin**
- Serbest metin girişi
- Varsayılan değer ayarlama

#### **Sayı**
- Numerik değer girişi
- Minimum/maksimum değer kontrolü

#### **Resim URL**
- Resim URL'si girişi
- Önizleme özelliği

## 🔧 **Konfigürasyon**

### **Shopify App Ayarları**
```toml
# shopify.app.toml
name = "Metafield JSON Editor"
client_id = "your_client_id"
application_url = "https://your-app-url.com"
embedded = true

[access_scopes]
scopes = "write_products,read_products,write_product_listings,read_product_listings"
```

### **Metafield Namespace**
App, `customizer` namespace'ini kullanır:
- **Namespace**: `customizer`
- **Key**: `options`
- **Type**: `json`

## 📊 **Metafield JSON Yapısı**

```json
[
  {
    "type": "color",
    "label": "Ürün Rengi",
    "key": "product_color",
    "required": true,
    "options": [
      { "label": "Kırmızı", "value": "red" },
      { "label": "Mavi", "value": "blue" },
      { "label": "Yeşil", "value": "green" }
    ],
    "defaultValue": "red"
  },
  {
    "type": "size",
    "label": "Ürün Boyutu",
    "key": "product_size",
    "required": false,
    "options": [
      { "label": "Küçük", "value": "small" },
      { "label": "Orta", "value": "medium" },
      { "label": "Büyük", "value": "large" }
    ],
    "defaultValue": "medium"
  }
]
```

## 🚀 **Deployment**

### **Production Deployment**
```bash
# App'i production'a deploy edin
npm run deploy

# Environment variables'ları güncelleyin
npm run env:push
```

### **Development**
```bash
# Geliştirme sunucusunu başlatın
npm run dev

# Test store'da app'i açın
npm run open
```

## 🔍 **Troubleshooting**

### **Yaygın Sorunlar**

1. **Metafield kaydedilemiyor**
   - Shopify API izinlerini kontrol edin
   - Metafield namespace'inin doğru olduğundan emin olun

2. **App yüklenmiyor**
   - Shopify CLI'nin güncel olduğundan emin olun
   - Partner hesabınızda app'in kayıtlı olduğunu kontrol edin

3. **GraphQL hataları**
   - API versiyonunun güncel olduğunu kontrol edin
   - Access scopes'ların doğru ayarlandığından emin olun

## 🤝 **Katkıda Bulunma**

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 **Lisans**

Bu proje MIT lisansı altında lisanslanmıştır.

## 📞 **İletişim**

- **Geliştirici**: Beyza Karapıçak
- **Email**: contact.karapicak@gmail.com
- **GitHub**: [github.com/beyzakrp](https://github.com/beyzakrp)

---

**Not**: Bu app Shopify Partner Programı kapsamında geliştirilmiştir ve Shopify'ın resmi API'lerini kullanmaktadır.
