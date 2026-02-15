document.addEventListener('DOMContentLoaded', function() {
    // 1. تنظیم نقشه و نمای اولیه
    var map = L.map('map').setView([32.4279, 53.6880], 4); // زوم روی ایران/خاورمیانه

    // 2. لایه نقشه پایه (OSM)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '© OpenStreetMap'
    }).addTo(map);

    // 3. لایه WMS از GeoServer
    var wmsLayer = L.tileLayer.wms('https://ahocevar.com/geoserver/wms', {
        layers: 'ne:ne_10m_admin_0_countries',
        format: 'image/png',
        transparent: true,
        version: '1.1.0',
        attribution: 'Natural Earth'
    });
    wmsLayer.addTo(map);

    // *** دیکشنری ترجمه فیلدها ***
    const fieldMapping = {
        'admin': 'نام کشور',
        'formal_en': 'نام رسمی',
        'pop_est': 'جمعیت تخمینی',
        'gdp_md_est': 'تولید ناخالص (میلیون دلار)',
        'continent': 'قاره',
        'subregion': 'منطقه جغرافیایی',
        'economy': 'وضعیت اقتصادی',
        'income_grp': 'گروه درآمدی',
        'iso_a3': 'کد ایزو',
        'type': 'نوع حکومت'
    };

    // 4. تعریف رویداد کلیک روی نقشه
    map.on('click', function(e) {
        // ساخت URL درخواست GetFeatureInfo
        var url = getFeatureInfoUrl(map, wmsLayer, e.latlng, {
            'info_format': 'application/json' 
        });

        // نمایش لودینگ در مودال
        var modalBody = document.getElementById('modal-body-content');
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="text-center py-4">
                    <div class="spinner-border text-primary" role="status"></div>
                    <p class="mt-2">در حال دریافت اطلاعات...</p>
                </div>`;
            
            // باز کردن مودال
            var myModalEl = document.getElementById('identifyModal');
            var myModal = new bootstrap.Modal(myModalEl);
            myModal.show();
        }

        // ارسال درخواست به پروکسی سرور
        fetch('/proxy_request?url=' + encodeURIComponent(url))
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                var content = "";

                if (data.features && data.features.length > 0) {
                    var props = data.features[0].properties;
                    
                    // شروع ساخت جدول
                    content = "<div class='table-responsive'><table class='table table-striped table-hover align-middle'>";
                    content += "<thead class='table-dark'><tr><th>ویژگی</th><th>مقدار</th></tr></thead><tbody>";
                    
                    let foundAnyData = false;

                    // پیمایش روی دیکشنری ترجمه (اولویت با فیلدهای مهم)
                    for (var key in fieldMapping) {
                        if (props.hasOwnProperty(key)) {
                            let value = props[key];
                            
                            // فرمت‌دهی اعداد (جدا کننده هزارگان)
                            if (typeof value === 'number') {
                                value = value.toLocaleString('fa-IR'); 
                            }

                            content += `<tr>
                                <td class="fw-bold">${fieldMapping[key]}</td>
                                <td>${value}</td>
                            </tr>`;
                            foundAnyData = true;
                        }
                    }

                    // اگر هیچ فیلد خاصی پیدا نشد، کل داده‌ها را نشان بده (حالت پشتیبان)
                    if (!foundAnyData) {
                        for (var key in props) {
                             content += `<tr><td>${key}</td><td>${props[key]}</td></tr>`;
                        }
                    }

                    content += "</tbody></table></div>";
                } 
                else {
                    // اگر کلیک روی دریاها یا نقاط خالی بود
                    content = "<div class='alert alert-warning text-center'>در این نقطه اطلاعاتی یافت نشد.</div>";
                }

                if (modalBody) modalBody.innerHTML = content;
            })
            .catch(error => {
                console.error('Fetch Error:', error);
                if (modalBody) {
                    modalBody.innerHTML = `<div class="alert alert-danger">خطا در دریافت اطلاعات:<br>${error.message}</div>`;
                }
            });
    });
});

// تابع کمکی برای ساخت URL (خارج از EventListener اصلی تعریف شده تا کد تمیزتر باشد)
function getFeatureInfoUrl(map, layer, latlng, params) {
    var point = map.latLngToContainerPoint(latlng, map.getZoom());
    var size = map.getSize();
    var bounds = map.getBounds();
    var sw = bounds.getSouthWest();
    var ne = bounds.getNorthEast();

    var defaultParams = {
        request: 'GetFeatureInfo',
        service: 'WMS',
        srs: 'EPSG:4326',
        styles: '',
        transparent: layer.wmsParams.transparent,
        version: layer.wmsParams.version,
        format: layer.wmsParams.format,
        bbox: sw.lng + ',' + sw.lat + ',' + ne.lng + ',' + ne.lat,
        height: size.y,
        width: size.x,
        layers: layer.wmsParams.layers,
        query_layers: layer.wmsParams.layers,
        info_format: 'application/json'
    };

    defaultParams[defaultParams.version === '1.3.0' ? 'i' : 'x'] = Math.round(point.x);
    defaultParams[defaultParams.version === '1.3.0' ? 'j' : 'y'] = Math.round(point.y);

    return layer._url + L.Util.getParamString(L.extend(defaultParams, params), layer._url, true);
}
