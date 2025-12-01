
        // --- PDF GENERATION ---
        function generateSteepnessReport(routeCoordinates) {
            if (!routeCoordinates || routeCoordinates.length < 2) {
                return [];
            }

            let segments = [];
            let currentSegment = {
                gradients: [],
                distance: 0,
                startDistance: 0
            };
            let lastSteepStatus = null;
            let cumulativeDistance = 0;

            for (let i = 1; i < routeCoordinates.length; i++) {
                const p1 = routeCoordinates[i - 1];
                const p2 = routeCoordinates[i];
                const segmentDistance = calculateHaversineDistance(p1, p2);
                const elevationDiff = p2[2] - p1[2];
                let gradient = 0;
                if (segmentDistance > 0) {
                    gradient = elevationDiff / segmentDistance;
                }
                
                const isSteep = gradient > CONFIG.STEEP_GRADIENT_THRESHOLD;

                if (i === 1) {
                    lastSteepStatus = isSteep;
                }

                if (isSteep !== lastSteepStatus) {
                    if (currentSegment.distance > 0) {
                        currentSegment.endDistance = cumulativeDistance;
                        currentSegment.isSteep = lastSteepStatus; // Attach status
                        segments.push(currentSegment);
                    }
                    currentSegment = {
                        gradients: [],
                        distance: 0,
                        startDistance: cumulativeDistance
                    };
                }
                
                currentSegment.gradients.push(gradient);
                currentSegment.distance += segmentDistance;
                cumulativeDistance += segmentDistance;
                lastSteepStatus = isSteep;
            }
            
            if (currentSegment.distance > 0) {
                currentSegment.endDistance = cumulativeDistance;
                currentSegment.isSteep = lastSteepStatus; // Attach status for the last segment
                segments.push(currentSegment);
            }

            return segments.map(seg => {
                const avgGradient = seg.gradients.reduce((a, b) => a + b, 0) / (seg.gradients.length || 1);
                const startKm = (seg.startDistance / 1000);
                const endKm = (seg.endDistance / 1000);

                return {
                    startKm: startKm.toFixed(2),
                    endKm: endKm.toFixed(2),
                    gradient: avgGradient.toFixed(1),
                    isSteep: seg.isSteep, // Use the attached status
                    distance: seg.distance
                };
            }).filter(seg => seg !== null);
        }

        // Helper to generate the HTML for the main statistics part of the report.
        function getPdfStatsHtml() {
            const totalDistance = document.getElementById('totalDistance').textContent;
            const steepUphillDistance = document.getElementById('steepUphillDistance').textContent;
            const elevationGain = document.getElementById('elevationGain').textContent;
            const routeName = (state.routeName && state.routeName !== '--') ? ` "${state.routeName}"` : '';

            return `
                <h1 style="font-size: 24px; font-weight: bold; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">Αναφορά Διαδρομής${routeName}</h1>
                <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 10px; text-align: center;">Στατιστικά</h2>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 16px;">
                    <tr style="border-bottom: 1px solid #ccc;"><td style="padding: 8px; font-weight: bold;">Συνολική Απόσταση:</td><td style="padding: 8px;">${totalDistance}</td></tr>
                    <tr style="border-bottom: 1px solid #ccc;"><td style="padding: 8px; font-weight: bold;">Μήκος Απότομης Ανάβασης (>5%):</td><td style="padding: 8px;">${steepUphillDistance}</td></tr>
                    <tr style="border-bottom: 1px solid #ccc;"><td style="padding: 8px; font-weight: bold;">Θετική Υψομετρική:</td><td style="padding: 8px;">${elevationGain}</td></tr>
                </table>
            `;
        }

        // Helper to generate the HTML for a chunk of the slope analysis table.
        function getPdfSlopeTableHtml(segments, totalSteepDistance, isFirstPage) {
            const formatDistance = (d) => d > 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} m`;
            
            let tableRowsHtml = segments.map(seg => {
                const gradientStyle = seg.isSteep ? 'color: red;' : '';
                let steepLengthText = '-';
                if (seg.isSteep) {
                    steepLengthText = `<span style="color: red;">${formatDistance(seg.distance)}</span>`;
                }
                return `
                    <div style="display: table-row; border-bottom: 1px solid #ccc;">
                        <div style="display: table-cell; padding: 12px; text-align: center;">${seg.startKm} km</div>
                        <div style="display: table-cell; padding: 12px; text-align: center;">${seg.endKm} km</div>
                        <div style="display: table-cell; padding: 12px; text-align: center; ${gradientStyle}">${(seg.gradient * 100).toFixed(1)}%</div>
                        <div style="display: table-cell; padding: 12px; text-align: center;">${steepLengthText}</div>
                    </div>
                `;
            }).join('');

            const title = isFirstPage ? 'Ανάλυση Κλίσεων' : 'Ανάλυση Κλίσεων (συνέχεια)';

            let fullTableHtml = `
                <h2 style="font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 10px; text-align: center;">${title}</h2>
                <div style="display: table; width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                    <div style="display: table-header-group; font-weight: bold; break-inside: avoid;">
                        <div style="display: table-row; border-bottom: 2px solid #555;">
                            <div style="display: table-cell; padding: 12px; text-align: center; width: 20%;">Από</div>
                            <div style="display: table-cell; padding: 12px; text-align: center; width: 20%;">Έως</div>
                            <div style="display: table-cell; padding: 12px; text-align: center; width: 20%;">Κλίση</div>
                            <div style="display: table-cell; padding: 12px; text-align: center; width: 40%;">Μήκος Απότομης Ανάβασης</div>
                        </div>
                    </div>
                    <div style="display: table-row-group;">
                        ${tableRowsHtml}
                    </div>
                </div>
            `;

            // Add total steep distance only on the last page
            if (totalSteepDistance !== null) {
                fullTableHtml += `
                    <div style="display: table; width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 15px; break-inside: avoid;">
                        <div style="display: table-row;">
                            <div style="display: table-cell; padding: 12px; text-align: left; font-weight: bold; width: 60%;">Συνολικό Μήκος Απότομης Ανάβασης (>5%):</div>
                            <div style="display: table-cell; padding: 12px; text-align: center; font-weight: bold; color: red; width: 40%;">${formatDistance(totalSteepDistance)}</div>
                        </div>
                    </div>
                `;
            }
            
            return fullTableHtml;
        }

        function getPdfWaypointsTableHtml(waypoints, isFirstPage, globalStartIndex = 0) {
            const tableRowsHtml = waypoints.map((waypoint, index) => {
                const pinNumber = globalStartIndex + index + 1;
                let addressText;
                switch (waypoint.status) {
                    case 'success':
                        addressText = waypoint.address || '-';
                        break;
                    case 'loading':
                        addressText = 'Αναζήτηση...';
                        break;
                    case 'error':
                        addressText = 'Μη διαθέσιμη';
                        break;
                    default: // 'empty' or other
                        addressText = '-';
                        break;
                }
                const coordsText = `${waypoint.lngLat.lat.toFixed(5)}, ${waypoint.lngLat.lng.toFixed(5)}`;

                return `
                    <div style="display: table-row; border-bottom: 1px solid #ccc;">
                        <div style="display: table-cell; padding: 12px; text-align: center; width: 15%;">${pinNumber}</div>
                        <div style="display: table-cell; padding: 12px; text-align: left; width: 55%;">${addressText}</div>
                        <div style="display: table-cell; padding: 12px; text-align: center; width: 30%;">${coordsText}</div>
                    </div>
                `;
            }).join('');

            const title = isFirstPage ? 'Σημεία Διαδρομής' : 'Σημεία Διαδρομής (συνέχεια)';

            return `
                <h2 style="font-size: 20px; font-weight: bold; margin-top: 30px; margin-bottom: 10px; text-align: center;">${title}</h2>
                <div style="display: table; width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
                    <div style="display: table-header-group; font-weight: bold; break-inside: avoid;">
                        <div style="display: table-row; border-bottom: 2px solid #555;">
                            <div style="display: table-cell; padding: 12px; text-align: center; width: 15%;">Σημείο</div>
                            <div style="display: table-cell; padding: 12px; text-align: left; width: 55%;">Διεύθυνση</div>
                            <div style="display: table-cell; padding: 12px; text-align: center; width: 30%;">Συντεταγμένες</div>
                        </div>
                    </div>
                    <div style="display: table-row-group;">
                        ${tableRowsHtml}
                    </div>
                </div>
            `;
        }

        // Helper to measure the pixel height of the table header and a sample row.
        async function measurePdfElements(reportElement, sampleSegment) {
            const canvasScale = 2;
            
            // 1. Measure Header
            const headerHtml = getPdfSlopeTableHtml([], null, true);
            reportElement.innerHTML = headerHtml;
            const headerCanvas = await html2canvas(reportElement, { scale: canvasScale });
            const headerHeight = headerCanvas.height;

            // 2. Measure Header + One Row
            const tableWithOneRowHtml = getPdfSlopeTableHtml([sampleSegment], null, true);
            reportElement.innerHTML = tableWithOneRowHtml;
            const combinedCanvas = await html2canvas(reportElement, { scale: canvasScale });
            const combinedHeight = combinedCanvas.height;

            // 3. Calculate Row Height
            const rowHeight = combinedHeight - headerHeight;

            return { headerHeight, rowHeight };
        }

        async function measureWaypointsTableElements(reportElement, sampleWaypoint) {
            const canvasScale = 2;
            
            // 1. Measure Header
            const headerHtml = getPdfWaypointsTableHtml([], true); // Empty array, isFirstPage=true
            reportElement.innerHTML = headerHtml;
            const headerCanvas = await html2canvas(reportElement, { scale: canvasScale });
            const headerHeight = headerCanvas.height;

            // 2. Measure Header + One Row
            const tableWithOneRowHtml = getPdfWaypointsTableHtml([sampleWaypoint], true);
            reportElement.innerHTML = tableWithOneRowHtml;
            const combinedCanvas = await html2canvas(reportElement, { scale: canvasScale });
            const combinedHeight = combinedCanvas.height;

            // 3. Calculate Row Height
            const rowHeight = combinedHeight - headerHeight;

            return { headerHeight, rowHeight };
        }

        function showPdfBlockedDialog(pdfUrl) {
            const dialog = document.getElementById('pdf-blocked-dialog');
            const confirmBtn = document.getElementById('pdf-open-confirm');
            const cancelBtn = document.getElementById('pdf-open-cancel');

            // This function will be the event handler.
            const handleConfirm = () => {
                window.open(pdfUrl, '_blank');
                hideDialog();
            };

            const hideDialog = () => {
                dialog.classList.add('hidden');
                // Clean up listeners to prevent them from stacking up if the dialog is shown multiple times.
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', hideDialog);
            };

            // Attach the listeners
            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', hideDialog);

            // Show the dialog
            dialog.classList.remove('hidden');
        }

        async function downloadRoutePDF() {
            if (!state.currentRoute) {
                showMessage('Δεν υπάρχει διαδρομή για λήψη', 'error');
                return;
            }

            if (typeof jspdf === 'undefined' || typeof html2canvas === 'undefined' || typeof htmlToImage === 'undefined') {
                showMessage('Οι βιβλιοθήκες PDF ή εικόνας δεν έχουν φορτωθεί. Δοκιμάστε ξανά.', 'error');
                return;
            }

            showMessage('Η δημιουργία του PDF βρίσκεται σε εξέλιξη... Παρακαλώ μην μετακινείτε τον χάρτη ή μην κάνετε αλλαγές, καθώς θα ληφθεί στιγμιότυπο της διαδρομής.', 'success');
            showLoading(true);

            // --- Setup ---
            const { jsPDF } = jspdf;
            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            const contentWidthMM = pdfWidth - margin * 2;
            const contentHeightMM = pdfHeight - margin * 2;
            const canvasScale = 2;

            const reportElement = document.createElement('div');
            reportElement.id = 'pdf-report-generator';
            reportElement.style.position = 'absolute';
            reportElement.style.left = '-9999px';
            reportElement.style.width = '800px'; // Use a fixed, high-res width
            reportElement.style.padding = '20px';
            reportElement.style.fontFamily = 'Arial, sans-serif';
            reportElement.style.color = '#000';
            reportElement.style.backgroundColor = '#fff';
            document.body.appendChild(reportElement);

                            const elementsToHide = [
                                document.getElementById('menuPanel'),
                                document.getElementById('topRightControls'),
                                document.getElementById('addressToggleContainer'),
                                document.getElementById('addressPanel'),
                                document.getElementById('instructions'),
                                document.getElementById('messageOverlay'),
                                document.getElementById('contextMenu'),
                                document.getElementById('hide-panel-button'),
                                document.getElementById('show-panel-button'),
                                document.getElementById('map-style-switcher'), // Hide map style switcher
                                document.getElementById('left-controls-container'),
                                ...document.querySelectorAll('.maptiler-control-container, .maplibregl-control-container')
                            ];            const originalDisplays = new Map();
            const bottomPanel = document.getElementById('bottomPanel');

            try {
                // --- Page 1: Stats ---
                reportElement.innerHTML = getPdfStatsHtml();
                const statsCanvas = await html2canvas(reportElement, { scale: canvasScale });
                const statsImgData = statsCanvas.toDataURL('image/png');
                const statsImgHeight = statsCanvas.height * contentWidthMM / statsCanvas.width;
                pdf.addImage(statsImgData, 'PNG', margin, margin, contentWidthMM, statsImgHeight);

                // --- Page 2...N: Waypoints Table ---
                if (state.pinAddresses && state.pinAddresses.length > 0) {
                    // 1. Measure
                    const { headerHeight, rowHeight } = await measureWaypointsTableElements(reportElement, state.pinAddresses[0]);
                    
                    // 2. Calculate rows per page
                    const pageCanvasHeight = reportElement.offsetWidth * canvasScale * (pdfHeight / pdfWidth);
                    const contentCanvasHeight = pageCanvasHeight - (margin * 2 * (pageCanvasHeight / pdfHeight));
                    
                    let rowsPerPage = Math.floor((contentCanvasHeight - headerHeight) / rowHeight);
                    if (rowsPerPage <= 0) rowsPerPage = 1;

                    // 3. Chunk waypoints
                    const chunks = [];
                    for (let i = 0; i < state.pinAddresses.length; i += rowsPerPage) {
                        chunks.push(state.pinAddresses.slice(i, i + rowsPerPage));
                    }

                    // 4. Render each chunk to a new page
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const currentGlobalStartIndex = i * rowsPerPage; // Calculate the starting index for this chunk
                        const tableHtml = getPdfWaypointsTableHtml(chunk, i === 0, currentGlobalStartIndex);
                        
                        reportElement.innerHTML = tableHtml;
                        const tableCanvas = await html2canvas(reportElement, { scale: canvasScale });
                        const tableImgData = tableCanvas.toDataURL('image/png');
                        const tableImgHeight = tableCanvas.height * contentWidthMM / tableCanvas.width;
                        
                        pdf.addPage();
                        pdf.addImage(tableImgData, 'PNG', margin, margin, contentWidthMM, tableImgHeight);
                    }
                }

                // --- Pages 3...N: Slope Analysis Table ---
                const segments = generateSteepnessReport(state.currentRoute.coordinates);
                if (segments.length > 0) {
                    const totalSteepDistance = segments.reduce((total, seg) => total + (seg.isSteep ? seg.distance : 0), 0);

                    // 1. Measure
                    const { headerHeight, rowHeight } = await measurePdfElements(reportElement, segments[0]);
                    
                    // 2. Calculate rows per page
                    const pageCanvasHeight = reportElement.offsetWidth * canvasScale * (pdfHeight / pdfWidth);
                    const contentCanvasHeight = pageCanvasHeight - (margin * 2 * (pageCanvasHeight / pdfHeight));
                    
                    let rowsPerPage = Math.floor((contentCanvasHeight - headerHeight) / rowHeight);
                    if (rowsPerPage <= 0) rowsPerPage = 1;

                    // 3. Chunk segments
                    const chunks = [];
                    for (let i = 0; i < segments.length; i += rowsPerPage) {
                        chunks.push(segments.slice(i, i + rowsPerPage));
                    }

                    // 4. Render each chunk to a new page
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const isLastChunk = i === chunks.length - 1;
                        const tableHtml = getPdfSlopeTableHtml(chunk, isLastChunk ? totalSteepDistance : null, i === 0);
                        
                        reportElement.innerHTML = tableHtml;
                        const tableCanvas = await html2canvas(reportElement, { scale: canvasScale });
                        const tableImgData = tableCanvas.toDataURL('image/png');
                        const tableImgHeight = tableCanvas.height * contentWidthMM / tableCanvas.width;
                        
                        pdf.addPage();
                        pdf.addImage(tableImgData, 'PNG', margin, margin, contentWidthMM, tableImgHeight);
                    }
                }

                // --- Final Page: Map Screenshot ---
                elementsToHide.forEach(el => {
                    if (el) {
                        originalDisplays.set(el, el.style.display);
                        el.style.display = 'none';
                    }
                });
                
                if (bottomPanel) {
                    bottomPanel.style.background = 'rgba(255, 255, 255, 0.9)';
                    bottomPanel.style.backdropFilter = 'none';
                    bottomPanel.style.webkitBackdropFilter = 'none';
                }

                // Wait for map to be fully rendered before taking screenshot
                state.map.triggerRepaint();
                await new Promise(resolve => {
                    state.map.once('idle', () => {
                        // A short timeout after idle seems to help html-to-image capture the final state
                        setTimeout(resolve, 100);
                    });
                });

                const mapImageData = await htmlToImage.toPng(document.body, {
                    quality: 0.95,
                    pixelRatio: 1.5,
                    filter: (node) => node.id !== 'pdf-report-generator'
                });

                const image = new Image();
                image.src = mapImageData;
                await new Promise(resolve => { image.onload = resolve; });

                pdf.addPage('a4', 'landscape');
                const pageW = pdf.internal.pageSize.getWidth();
                const pageH = pdf.internal.pageSize.getHeight();
                const pageAspectRatio = pageW / pageH;
                const imageAspectRatio = image.width / image.height;

                let finalImgW, finalImgH, posX, posY;
                if (imageAspectRatio > pageAspectRatio) {
                    finalImgW = pageW;
                    finalImgH = pageW / imageAspectRatio;
                    posX = 0;
                    posY = (pageH - finalImgH) / 2;
                } else {
                    finalImgH = pageH;
                    finalImgW = pageH * imageAspectRatio;
                    posX = (pageW - finalImgW) / 2;
                    posY = 0;
                }

                pdf.addImage(mapImageData, 'PNG', posX, posY, finalImgW, finalImgH);

                // Generate the blob URL and open it in a new tab.
                const pdfBlob = pdf.output('blob');
                const pdfUrl = URL.createObjectURL(pdfBlob);
                
                const newTab = window.open(pdfUrl, '_blank');
                if (!newTab) {
                    showPdfBlockedDialog(pdfUrl);
                }

            } catch (error) {
                console.error("PDF generation failed:", error);
                showMessage('Η δημιουργία του PDF απέτυχε.', 'error');
            } finally {
                document.body.removeChild(reportElement);
                originalDisplays.forEach((display, el) => {
                    if(el) el.style.display = display;
                });
                
                if (bottomPanel) {
                    bottomPanel.style.background = '';
                    bottomPanel.style.backdropFilter = '';
                    bottomPanel.style.webkitBackdropFilter = '';
                }

                showLoading(false);
            }
        }


        // --- CONFIGURATION ---
                // --- CONFIGURATION ---
                const CONFIG = {
                    MAPTILER_PUBLIC_KEY: 'u8zRQYN6M4dzdhc7tvka', // <-- ΑΝΤΙΚΑΤΑΣΤΗΣΕ ΤΟ ΜΕ ΤΟ ΔΗΜΟΣΙΟ ΚΛΕΙΔΙ ΣΟΥ
                    GRAPHHOPPER_PUBLIC_KEY: 'f9d9a046-0db0-48a8-a935-d44e62700a40', // <-- ΒΑΛΕ ΕΔΩ ΤΟ ΚΛΕΙΔΙ ΣΟΥ ΑΠΟ ΤΟ GRAPHHOPPER
                    ELEVATION_API_URL: '/api/open-elevation/lookup', // Use proxy
                    MAX_PINS: 40, // Number of Pins
                    DEFAULT_CENTER: [39.663967, 20.852770], // Ioannina, Greece
                    DEFAULT_ZOOM: 13,                    STEEP_GRADIENT_THRESHOLD: 0.05, // percentage
                    HISTORY_LIMIT: 40, // Max undo actions 
                };        
        // --- GLOBAL STATE ---
        const state = {
            map: null,
            pins: [], // Stores maptilersdk.LngLat objects
            markers: [], // Stores maptilersdk.Marker objects
            elevationChart: null,
            currentRoute: null,
            mapStyleData: [
                { name: 'Οδικός', style: maptilersdk.MapStyle.STREETS, image: 'assets/Streets.png' },
                { name: 'Δορυφορικός', style: maptilersdk.MapStyle.SATELLITE, image: 'assets/Satellite.png' },
                { name: 'Υβριδικός', style: maptilersdk.MapStyle.HYBRID, image: 'assets/Hybrid.png' },
                { name: 'Τοπογραφικός', style: maptilersdk.MapStyle.TOPO, image: 'assets/Topographic.png' },
                { name: 'Απλός', style: maptilersdk.MapStyle.BASIC, image: 'assets/Minimal.png' }
            ],
            activeMapStyleName: 'Οδικός',
            styleMenuCloseTimer: null,
            currentElevation: { data: [], coordinates: [] },
            highlightMarker: null,
            selectedMarkerIndex: -1,
            searchResultMarker: null,
            isRoundTrip: false,
            isChartJsLoaded: false,
            history: [],
            historyIndex: -1,
            showSteepHighlight: false,
            // Search state
            searchSuggestions: [],
            highlightedSuggestionIndex: -1,
            isSearchLoading: false,
            // Address Panel state
            pinAddresses: [], // Will be an array of {status, address, lngLat} objects
            isAddressPanelVisible: false,
            isAddressPanelMoved: false,
            // Route Naming state
            routeName: '',
            isRouteNameUserModified: false,
        };

        // --- ADDRESS PANEL LOGIC ---

        // --- ROUTE NAMING LOGIC ---

        /**
         * Parses a raw address string from the geocoding API into structured components.
         * This is a heuristic-based parser.
         * @param {string} addressString The full address string.
         * @returns {object} An object with { street, city, country }.
         */
                function parseAddress(addressString) {
                    if (!addressString || typeof addressString !== 'string') {
                        return { street: null, city: null, country: null };
                    }
        
                    const parts = addressString.split(',').map(p => p.trim());
                    if (parts.length === 0) {
                        return { street: null, city: null, country: null };
                    }
        
                    // The most specific place name is almost always the first part.
                    let street = parts[0] || null;
        
                    // The country is always the last part.
                    const country = parts[parts.length - 1] || null;
        
                    // The city is usually the second-to-last part.
                    let city = (parts.length > 1) ? parts[parts.length - 2] : null;
        
                    // Clean up city (remove postal codes)
                    if (city) {
                        city = city.replace(/\d/g, '').trim();
                    }
                    
                    // If we only have two parts, e.g., "Ioannina, Greece", then:
                    // street = "Ioannina", country = "Greece", city = "Ioannina". This is correct.
                    if (parts.length === 2) {
                        city = street;
                    }
        
                    // Remove trailing numbers from the street name
                    if (street) {
                        street = street.replace(/\s+\d+$/, '').trim();
                    }
        
                    return { street, city, country };
                }

        /**
         * Generates and sets the default route name based on the first and last pins.
         */
        function generateDefaultRouteName() {
            if (state.isRouteNameUserModified || state.pinAddresses.length < 1) {
                if(state.pinAddresses.length < 1) {
                    state.routeName = '--';
                    updateRouteNameUI();
                }
                return;
            }

            const startPin = state.pinAddresses[0];
            const endPin = state.pinAddresses[state.pinAddresses.length - 1];

            if (!startPin) {
                state.routeName = '--';
                updateRouteNameUI();
                return;
            }

            // Handle loading state
            if (startPin.status === 'loading' || (state.pinAddresses.length > 1 && endPin.status === 'loading')) {
                state.routeName = 'Δημιουργία ονόματος...';
                updateRouteNameUI();
                return;
            }
            
            // Handle single pin case
            if (state.pinAddresses.length === 1) {
                 if (startPin.status === 'success') {
                    state.routeName = startPin.address;
                } else {
                    state.routeName = 'Αναμένεται σημείο...'
                }
                updateRouteNameUI();
                return;
            }

            // Handle round trip
            if (state.isRoundTrip) {
                if (startPin.status === 'success') {
                    const startAddr = parseAddress(startPin.address);
                    state.routeName = `${startAddr.city || startAddr.street}, ${startAddr.street} (Κυκλική)`;
                } else {
                    state.routeName = 'Κυκλική Διαδρομή';
                }
                updateRouteNameUI();
                return;
            }

            // Handle normal two-or-more-pin route
            if (startPin.status === 'success' && endPin.status === 'success') {
                const startAddr = parseAddress(startPin.address);
                const endAddr = parseAddress(endPin.address);

                // Helper to format a location part, avoiding duplicates for villages/POIs
                const formatPart = (addr) => {
                    if (!addr.city) return addr.street || '';
                    if (!addr.street) return addr.city || '';
                    // If street and city are the same (common for villages), just use one.
                    if (addr.street === addr.city) {
                        return addr.city;
                    }
                    // Otherwise, combine them.
                    return `${addr.city}, ${addr.street}`;
                };

                const startPart = formatPart(startAddr);
                const endPart = formatPart(endAddr);

                if (startAddr.country !== endAddr.country) {
                    state.routeName = `${startAddr.country}, ${startPart} → ${endAddr.country}, ${endPart}`;
                } else if (startAddr.city !== endAddr.city) {
                    state.routeName = `${startPart} → ${endPart}`;
                } else { // Same city
                    if (startAddr.street === endAddr.street) {
                         state.routeName = `${startAddr.city}: ${startAddr.street}`;
                    } else {
                         state.routeName = `${startAddr.city}: ${startAddr.street} → ${endAddr.street}`;
                    }
                }
            } else {
                state.routeName = 'Επεξεργασία διαδρομής...';
            }
            
            updateRouteNameUI();
        }

        /**
         * Updates the route name display in the UI.
         */
        function updateRouteNameUI() {
            const routeNameSpan = document.getElementById('routeName');
            if (routeNameSpan) {
                routeNameSpan.textContent = state.routeName || '--';
                routeNameSpan.title = state.routeName || 'Κάντε κλικ για επεξεργασία';
            }
        }

        /**
         * Initializes event listeners for the route name editing functionality.
         */
        function setupRouteNameEditing() {
            const container = document.getElementById('routeNameContainer');
            const display = document.getElementById('routeName');
            const editButton = document.getElementById('editRouteNameBtn');
            const input = document.getElementById('routeNameInput');

            let lastGeneratedDefaultName = ''; // To store the default name before editing

            const startEditing = () => {
                if (state.pins.length === 0) return;

                // Store the current name, whether it's default or custom.
                const currentName = state.routeName;

                // Temporarily disable the user-modified flag to force generation of the default name.
                const tempIsUserModified = state.isRouteNameUserModified;
                state.isRouteNameUserModified = false; 
                
                // Generate and capture the most up-to-date default name for potential reverts.
                generateDefaultRouteName(); 
                lastGeneratedDefaultName = state.routeName; 
                
                // Restore the user-modified flag.
                state.isRouteNameUserModified = tempIsUserModified;

                // If the name was user-modified, restore the user's custom name to the state.
                // Otherwise, state.routeName already holds the latest default name.
                if (state.isRouteNameUserModified) {
                    state.routeName = currentName;
                }

                display.classList.add('hidden');
                editButton.classList.add('hidden');
                input.classList.remove('hidden');
                input.value = state.routeName; // This will now be the user's custom name if it existed.
                input.focus();
                input.select();
            };

            const stopEditing = () => {
                const newName = input.value.trim();
                
                // If the new name is empty, revert to the last generated default name
                if (!newName) {
                    state.routeName = lastGeneratedDefaultName;
                    state.isRouteNameUserModified = false;
                } else if (newName === lastGeneratedDefaultName) {
                    // If the user typed back the default name, treat it as not user-modified
                    state.routeName = newName;
                    state.isRouteNameUserModified = false;
                } else {
                    // User provided a truly custom name
                    let finalName = newName;
                    if (newName.length > 60) {
                        finalName = newName.substring(0, 60);
                        showMessage('Το όνομα διαδρομής περικόπηκε στους 60 χαρακτήρες.', 'warning');
                    }
                    state.routeName = finalName;
                    state.isRouteNameUserModified = true;
                }
                
                updateRouteNameUI();
                display.classList.remove('hidden');
                editButton.classList.remove('hidden');
                input.classList.add('hidden');
                saveState();
            };

            display.addEventListener('click', startEditing);
            editButton.addEventListener('click', startEditing);
            
            input.addEventListener('blur', stopEditing);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur(); // This will trigger the stopEditing logic
                } else if (e.key === 'Escape') {
                    input.value = state.routeName; // Revert changes
                    input.blur();
                }
            });
        }

        /**
         * Renders the list of addresses in the address panel based on the current state.
         */
        function renderAddressList() {
            const listEl = document.getElementById('addressList');

            if (!state.isAddressPanelVisible) {
                return;
            }

            if (state.pinAddresses.length === 0) {
                listEl.innerHTML = '<p id="no-addresses-message" class="text-gray-500 text-sm">Προσθέστε σημεία στη διαδρομή για να δείτε τις διευθύνσεις.</p>';
                return;
            }

            listEl.innerHTML = state.pinAddresses.map((item, index) => {
                let addressText = '';
                let isError = false;
                let isLoading = false;

                switch (item.status) {
                    case 'loading':
                        addressText = 'Αναζήτηση...';
                        isLoading = true;
                        break;
                    case 'success':
                        addressText = item.address;
                        break;
                    case 'error':
                        addressText = 'Αποτυχία λήψης';
                        isError = true;
                        break;
                    default: // 'empty'
                        addressText = '...';
                        break;
                }

                const isStart = index === 0;
                let pinClass = 'pin-icon';
                let pinContent = index + 1;
                if (isStart) {
                    pinClass += ' start';
                    if (state.isRoundTrip && state.pins.length > 1) {
                        pinClass += ' flag';
                        pinContent = '🏁';
                    }
                }

                let actionButton = '';
                if (isLoading) {
                    actionButton = '<div class="search-spinner" style="width: 16px; height: 16px;"></div>';
                } else if (isError) {
                    actionButton = `<button class="p-1 rounded-full hover:bg-gray-400/30 retry-address-btn" data-index="${index}" title="Επανάληψη">
                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 12c0 2.972 1.154 5.661 3.042 7.707M20 20v-5h-.581m0 0a8.001 8.001 0 01-15.357-2A8.001 8.001 0 0120 12c0-2.972-1.154-5.661-3.042-7.707"></path></svg>
                    </button>`;
                }

                return `
                <div class="address-item flex items-center justify-between gap-3 p-2 rounded-md hover:bg-black/10" data-index="${index}">
                    <div class="flex items-center gap-3 cursor-pointer min-w-0">
                        <div class="flex-shrink-0">
                            <div class="${pinClass}" style="width: 28px; height: 28px; font-size: 13px; line-height: 28px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">${pinContent}</div>
                        </div>
                        <div class="text-sm font-medium truncate ${isError ? 'text-red-600' : 'text-gray-800'}" title="${addressText}">${addressText}</div>
                    </div>
                    <div class="flex-shrink-0">${actionButton}</div>
                </div>
                `;
            }).join('');

            // Add event listeners for the "retry" buttons
            listEl.querySelectorAll('.retry-address-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const indexToRetry = parseInt(e.target.dataset.index, 10);
                    if (!isNaN(indexToRetry)) {
                        fetchAddressForPin(indexToRetry, true); // force retry
                    }
                });
            });

            // Add event listeners for panning to pin
            listEl.querySelectorAll('.address-item').forEach(itemEl => {
                itemEl.addEventListener('click', (e) => {
                    // Prevent clicking the retry button from also panning
                    if (e.target.closest('.retry-address-btn')) {
                        return;
                    }
                    const indexToPan = parseInt(itemEl.dataset.index, 10);
                    if (!isNaN(indexToPan)) {
                        panToPin(indexToPan);
                    }
                });
            });
        }


        /**
         * Fetches a human-readable address from geographic coordinates using MapTiler API.
         * @param {maptilersdk.LngLat} lngLat The coordinates to reverse geocode.
         * @returns {Promise<string>} A promise that resolves to the address string.
         */
        async function getAddressFromCoordinates(lngLat) {
            const url = `/api/maptiler/geocoding/${lngLat.lng},${lngLat.lat}.json?language=el`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok.');
            }
            const data = await response.json();
            if (data.features && data.features.length > 0) {
                return data.features[0].place_name;
            } else {
                throw new Error('No address found for these coordinates.');
            }
        }

        /**
         * Fetches and updates the address for a specific pin.
         * @param {number} index The index of the pin in the state.pins array.
         * @param {boolean} [force=false] If true, refetches the address even if it already exists.
         */
        async function fetchAddressForPin(index, force = false) {
            if (index < 0 || index >= state.pinAddresses.length) return;

            const item = state.pinAddresses[index];
            if (!item) return;

            // Don't refetch if already successful, unless forced
            if (item.status === 'success' && !force) return;
            // Don't start a new fetch if one is already in progress
            if (item.status === 'loading') return;

            item.status = 'loading';
            renderAddressList();

            try {
                const address = await getAddressFromCoordinates(item.lngLat);
                if (typeof address === 'string' || address instanceof String) {
                    item.address = address;
                    item.status = 'success';
                    generateDefaultRouteName(); // Update route name when an address is fetched
                } else {
                    throw new Error("Invalid address format received.");
                }
            } catch (error) {
                console.error(`Failed to fetch address for pin ${index}:`, error);
                item.address = error.message; // Store error message
                item.status = 'error';
            }
            
            renderAddressList();
        }

        /**
         * Retries fetching addresses for all pins that previously failed.
         */
        function retryFailedAddresses() {
            state.pinAddresses.forEach((item, index) => {
                if (item.status === 'error') {
                    fetchAddressForPin(index, true); // Force retry
                }
            });
        }

        function panToPin(index) {
            if (state.pins[index]) {
                state.map.flyTo({ center: state.pins[index], zoom: 16 });
                
                // Remove highlight from previously selected marker
                if (state.selectedMarkerIndex !== -1 && state.markers[state.selectedMarkerIndex]) {
                    state.markers[state.selectedMarkerIndex].getElement().classList.remove('selected');
                }
                
                state.selectedMarkerIndex = index;
                
                // Add highlight to the new selected marker
                if (state.markers[index]) {
                    state.markers[index].getElement().classList.add('selected');
                }
            }
        }

        function updateAddressListHeight() {
            const panel = document.getElementById('addressPanel');
            const header = document.getElementById('addressPanelHeader');
            const list = document.getElementById('addressList');

            if (!panel || !header || !list || panel.classList.contains('menu-hidden')) return;

            const panelStyle = window.getComputedStyle(panel);
            const headerStyle = window.getComputedStyle(header);

            const panelPaddingTop = parseInt(panelStyle.paddingTop, 10);
            const panelPaddingBottom = parseInt(panelStyle.paddingBottom, 10);
            const headerTotalHeight = header.offsetHeight + parseInt(headerStyle.marginBottom, 10);
            
            const availableHeight = panel.offsetHeight - panelPaddingTop - panelPaddingBottom - headerTotalHeight;

            list.style.maxHeight = Math.max(0, availableHeight) + 'px';
        }

        function adjustPanelHeightForContent() {
            const panel = document.getElementById('addressPanel');
            // Don't run if panel is hidden or has been manually resized by the user
            if (!panel || panel.classList.contains('menu-hidden') || panel.style.height) {
                return;
            }

            const header = document.getElementById('addressPanelHeader');
            const numItems = state.pinAddresses.length;
            if (numItems === 0) { // If list is empty, do nothing, let it be small
                return;
            }

            const itemsToShow = Math.min(numItems, 5);
            
            // Estimate heights
            const itemHeight = 44; // Approx height of one .address-item
            const panelStyle = window.getComputedStyle(panel);
            const headerStyle = window.getComputedStyle(header);
            const panelPaddingTop = parseInt(panelStyle.paddingTop, 10);
            const panelPaddingBottom = parseInt(panelStyle.paddingBottom, 10);
            const headerTotalHeight = header.offsetHeight + parseInt(headerStyle.marginBottom, 10);

            const targetListHeight = itemsToShow * itemHeight;
            const targetPanelHeight = headerTotalHeight + targetListHeight + panelPaddingTop + panelPaddingBottom;

            panel.style.height = targetPanelHeight + 'px';

            // After setting the panel height, update the list's max-height to fill it
            updateAddressListHeight();
        }

        function removePin(index) {
            if (index < 0 || index >= state.pins.length) return;

            state.pins.splice(index, 1);
            state.pinAddresses.splice(index, 1);

            redrawFromState();
            saveState();
            
            // Adjust panel height if it's open
            const panel = document.getElementById('addressPanel');
            if(panel) panel.style.height = ''; // Clear manual height to allow auto-adjust
            adjustPanelHeightForContent();
        }

        // --- DRAGGABLE ELEMENTS LOGIC ---
        let isDragging = false; // Flag to differentiate between a drag and a click
        function initializeDraggableElements() {
            const addressPanel = document.getElementById('addressPanel');
            const addressPanelHeader = document.getElementById('addressPanelHeader');
            const addressToggleContainer = document.getElementById('addressToggleContainer');
            const resizeHandle = document.getElementById('resizeHandle');

            makeDraggable(addressPanel, addressPanelHeader);
            makeDraggable(addressToggleContainer, addressToggleContainer);
            makeResizable(addressPanel, resizeHandle);
        }

        function makeDraggable(elmnt, handle) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            
            handle.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                isDragging = false; // Reset flag on mousedown
                e = e || window.event;
                e.preventDefault();

                // If the element is positioned with 'right', convert it to 'left' on first drag
                if (elmnt.style.right && !elmnt.style.left) {
                    elmnt.style.left = elmnt.offsetLeft + 'px';
                    elmnt.style.right = 'auto';
                }

                // get the mouse cursor position at startup: 
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                // call a function whenever the cursor moves:
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                isDragging = true; // Set flag to true if mouse moves while dragging
                e = e || window.event;
                e.preventDefault();
                // calculate the new cursor position: 
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                
                // Calculate new element position
                let newTop = elmnt.offsetTop - pos2;
                let newLeft = elmnt.offsetLeft - pos1;

                // Boundary collision detection
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const elmntWidth = elmnt.offsetWidth;
                const elmntHeight = elmnt.offsetHeight;

                if (newLeft < 0) newLeft = 0;
                if (newTop < 0) newTop = 0;
                if (newLeft + elmntWidth > viewportWidth) newLeft = viewportWidth - elmntWidth;
                if (newTop + elmntHeight > viewportHeight) newTop = viewportHeight - elmntHeight;

                // set the element's new position: 
                elmnt.style.top = newTop + "px";
                elmnt.style.left = newLeft + "px";

                // If dragging the address panel, set the moved flag
                if (elmnt.id === 'addressPanel') {
                    state.isAddressPanelMoved = true;
                }
            }

            function closeDragElement() {
                // stop moving when mouse button is released:
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }

        function makeResizable(elmnt, handle) {
            let initialWidth = 0, initialHeight = 0;
            let initialX = 0, initialY = 0;
            const minWidth = 280;
            const minHeight = 200;

            handle.onmousedown = resizeMouseDown;

            function resizeMouseDown(e) {
                e = e || window.event;
                e.preventDefault();
                e.stopPropagation(); // Prevent drag from starting

                initialWidth = elmnt.offsetWidth;
                initialHeight = elmnt.offsetHeight;
                initialX = e.clientX;
                initialY = e.clientY;

                document.onmouseup = closeResizeElement;
                document.onmousemove = elementResize;
            }

            function elementResize(e) {
                e = e || window.event;
                e.preventDefault();

                const dx = e.clientX - initialX;
                const dy = e.clientY - initialY;

                let newWidth = initialWidth + dx;
                let newHeight = initialHeight + dy;

                if (newWidth < minWidth) newWidth = minWidth;
                if (newHeight < minHeight) newHeight = minHeight;

                elmnt.style.width = newWidth + 'px';
                elmnt.style.height = newHeight + 'px';

                // Update the list height dynamically on resize
                if (elmnt.id === 'addressPanel') {
                    updateAddressListHeight();
                }
            }

            function closeResizeElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }
                // --- DUPLICATED BLOCK REMOVED ---

        let rightClickLatLng = null; // Stores the LngLat of the right-click event
        let insertIndex = -1; // Stores the calculated index for waypoint insertion
        let rightClickedPinIndex = -1; // Stores the index of the right-clicked marker
        // --- UI ELEMENTS & SHARED VARIABLES ---
        let bottomPanel, hidePanelButton, showPanelButton;
        let activeSearchTooltip = null; // NEW: Variable to hold the active search result tooltip
        let markerRemovalTimer = null; // Timer to control the removal of the elevation highlight marker

        // --- INITIALIZATION ---
        document.addEventListener('DOMContentLoaded', initApp);

        function initApp() {
            initMap();
            initUIElements();
            setupEventListeners();
            setupRouteNameEditing();
            initializeDraggableElements();
            initMapStyleSwitcher(); // New function for the map style widget
            
            if (!parseUrlAndRestore()) {
                // saveState(); // TODO: Re-enable after refactoring saveState
            }
            
            updateStatsVisibility(false);
            console.log('Εφαρμογή Σχεδιασμού Διαδρομής αρχικοποιήθηκε με MapTiler SDK.');
        }

        // --- NEW MAP STYLE SWITCHER LOGIC ---

        /**
         * Initializes the new map style switcher widget, renders it, and sets up event listeners for hover and click.
         */
        function initMapStyleSwitcher() {
            const container = document.getElementById('map-style-switcher');
            if (!container) return;
            
            // Initial render
            renderMapStyleSwitcher();

            // Setup event listeners for the container
            const innerContainer = container.querySelector('.map-style-container');

            // Event listener for clicks (delegated)
            container.addEventListener('click', (e) => {
                const target = e.target.closest('.map-style-item');
                if (target && target.dataset.styleName) {
                    handleMapStyleClick(target.dataset.styleName);
                }
            });

            // Event listeners for hover with delay
            container.addEventListener('mouseenter', () => {
                clearTimeout(state.styleMenuCloseTimer);
                const innerContainer = container.querySelector('.map-style-container');
                if (innerContainer) {
                    innerContainer.classList.add('menu-visible');
                }
            });

            container.addEventListener('mouseleave', () => {
                state.styleMenuCloseTimer = setTimeout(() => {
                    const innerContainer = container.querySelector('.map-style-container');
                    if (innerContainer) {
                        innerContainer.classList.remove('menu-visible');
                    }
                }, 1500); // 1.5 second delay
            });
        }

        /**
         * Renders the HTML for the map style switcher widget based on the current state.
         * This function is called by initMapStyleSwitcher and handleMapStyleClick.
         */
        function renderMapStyleSwitcher() {
            const container = document.getElementById('map-style-switcher');
            if (!container) return;

            const activeStyle = state.mapStyleData.find(s => s.name === state.activeMapStyleName);
            const inactiveStyles = state.mapStyleData.filter(s => s.name !== state.activeMapStyleName);

            // Helper to generate a single item
            const createStyleItem = (style, is_active = false) => {
                const longTextClass = (style.name === 'Τοπογραφικός' || style.name === 'Δορυφορικός') ? 'long-text' : '';
                const id_attr = is_active ? 'id="active-map-style"' : '';
                return `
                    <button ${id_attr} class="map-style-item ${longTextClass}" data-style-name="${style.name}">
                        <img src="${style.image}" alt="${style.name}" class="map-style-thumbnail">
                        <div class="map-style-label"><span>${style.name}</span></div>
                    </button>
                `;
            }

            let menuItemsHtml = inactiveStyles.map(style => createStyleItem(style, false)).join('');
            const activeItemHtml = createStyleItem(activeStyle, true);

            // Keep the .menu-visible class if it's already there
            const currentInnerContainer = container.querySelector('.map-style-container');
            const wasVisible = currentInnerContainer ? currentInnerContainer.classList.contains('menu-visible') : false;

            const widgetHtml = `
                <div class="map-style-container ${wasVisible ? 'menu-visible' : ''}">
                    ${activeItemHtml}
                    <div class="map-style-menu glass-panel">
                        ${menuItemsHtml}
                    </div>
                </div>
            `;
            
            container.innerHTML = widgetHtml;
        }

        /**
         * Handles the click on a map style item.
         * @param {string} styleName The name of the style that was clicked.
         */
        function handleMapStyleClick(styleName) {
            if (styleName === state.activeMapStyleName) {
                // If the active style is clicked, do nothing.
                // This could be used to just close the menu if it's sticky.
                return;
            }

            const selectedStyleData = state.mapStyleData.find(s => s.name === styleName);
            if (!selectedStyleData) return;

            // Set the new style on the map
            state.map.setStyle(selectedStyleData.style);
            
            // Update the state
            state.activeMapStyleName = styleName;
            
            // Re-render the widget to reflect the change
            renderMapStyleSwitcher();

            // After the style changes, re-apply our custom sources/layers.
            // This is critical because setStyle removes all existing layers and sources.
            state.map.once('styledata', () => {
                reapplyCustomMapElements();
                if (state.currentRoute) {
                    state.map.once('idle', () => {
                        // A final check in case the user cleared the route while the style was changing
                        if (state.currentRoute) {
                            displayColoredRoute(state.currentRoute.coordinates);
                        }
                    });
                }
            });
        }
        
        function initUIElements() {
            bottomPanel = document.getElementById('bottomPanel');
            hidePanelButton = document.getElementById('hide-panel-button');
            showPanelButton = document.getElementById('show-panel-button');
        }
        
        function initMap() {
            maptilersdk.config.apiKey = CONFIG.MAPTILER_PUBLIC_KEY; // Keep API key for direct tile loading

            const initialStyle = state.mapStyleData.find(s => s.name === state.activeMapStyleName).style;

            state.map = new maptilersdk.Map({
                container: 'map',
                style: initialStyle,
                center: [CONFIG.DEFAULT_CENTER[1], CONFIG.DEFAULT_CENTER[0]],
                zoom: CONFIG.DEFAULT_ZOOM,
                hash: false,
                preserveDrawingBuffer: true,
                transformRequest: (url, resourceType) => {
                    // Only intercept MapTiler API calls (not actual tiles)
                    if (url.includes('api.maptiler.com')) {
                        // Exclude tile requests from proxying
                        if (resourceType === 'Tile') {
                            return { url }; // Return original URL for tiles (direct access)
                        }

                        // For other MapTiler API requests (e.g., style.json, terrain metadata), use the proxy
                        const proxiedUrl = new URL(url);
                        proxiedUrl.searchParams.delete('key'); // Remove original key, proxy will add it
                        const finalUrl = `/api/maptiler${proxiedUrl.pathname}${proxiedUrl.search}`;
                        return { url: finalUrl };
                    }
                    return { url }; // For non-MapTiler requests, do nothing.
                }
            });

            state.map.on('load', () => {
                // Add standard controls to the top-left corner.
                // state.map.addControl(new maptilersdk.NavigationControl(), 'top-left');
                // state.map.addControl(new maptilersdk.TerrainControl({
                //     source: 'terrainSource', // Source is added in reapplyCustomMapElements
                //     exaggeration: 1.5
                // }), 'top-left');

                // Initialize all our custom data sources and layers
                reapplyCustomMapElements();

                // Merge top-left and top-right controls into one block
                const controlContainer = state.map.getContainer().querySelector('.maplibregl-control-container, .maptiler-control-container');
                if (controlContainer) {
                    const topLeft = controlContainer.querySelector('.maplibregl-ctrl-top-left, .maptiler-ctrl-top-left');
                    const topRight = controlContainer.querySelector('.maplibregl-ctrl-top-right, .maptiler-ctrl-top-right');

                    if (topLeft && topRight) {
                        // Move all children from top-right to top-left
                        while (topRight.firstChild) {
                            topLeft.appendChild(topRight.firstChild);
                        }
                        topRight.style.display = 'none'; // Hide the empty container
                    }
                }
            });
            
            state.map.on('click', handleMapClick);
            state.map.on('contextmenu', handleMapRightClick);
            
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const { latitude, longitude } = position.coords;
                        state.map.flyTo({ center: [longitude, latitude], zoom: CONFIG.DEFAULT_ZOOM });
                    },
                    (error) => console.log('Η γεωεντοποπιση απέτυχε:', error.message),
                    { timeout: 5000 }
                );
            }
        }
        
        function reapplyCustomMapElements() {
            // This function adds back all sources and layers that are not part of the map style
            // and are therefore removed whenever setStyle is called.

            // Guard against running multiple times
            if (state.map.getSource('routeSource')) return;

            // Add terrain source
            state.map.addSource('terrainSource', {
                type: 'raster-dem',
                // The `transformRequest` function in initMap will handle proxying this URL
                url: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json` 
            });

            // Add route data sources
            state.map.addSource('routeSource', { type: 'geojson', data: { type: 'Feature', geometry: null } });
            state.map.addSource('steepRouteSource', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

            // Add layers
            state.map.addLayer({
                id: 'routeLayer',
                type: 'line',
                source: 'routeSource',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.8 }
            });

            // Add the missing steep route layer
            state.map.addLayer({
                id: 'steepRouteLayer',
                type: 'line',
                source: 'steepRouteSource',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-color': '#E53E3E', // A strong red color
                    'line-width': 6, // Slightly wider to be visible over the blue line
                    'line-opacity': state.showSteepHighlight ? 0.8 : 0 // Initial opacity based on state
                }
            });
            // If a route already exists in the state, redraw it on the new style
            if (state.currentRoute) {
                displayColoredRoute(state.currentRoute.coordinates);
            }
        }


        function setupEventListeners() {
            document.getElementById('clearRoute').addEventListener('click', () => {
            state.pins = [];
            state.pinAddresses = [];
            renderAddressList();
            clearRoute(true);
            // After clearing, the panel should shrink. We need to clear its height
            // so adjustPanelHeightForContent can work properly if it's re-opened.
            const panel = document.getElementById('addressPanel');
            if(panel) panel.style.height = '';
            adjustPanelHeightForContent();
            });
            document.getElementById('downloadGPX').addEventListener('click', downloadGPX);
            document.getElementById('uploadGPX').addEventListener('click', () => document.getElementById('gpx-file-input').click());
            document.getElementById('gpx-file-input').addEventListener('change', handleGpxFileUpload);
            document.getElementById('recalculateRoute').addEventListener('click', calculateRoute);
            document.getElementById('downloadPDF').addEventListener('click', downloadRoutePDF);
            document.getElementById('shareButton').addEventListener('click', copyShareLink);
            document.getElementById('undoButton').addEventListener('click', undo);

            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                    // Check if the undo button is not disabled before acting
                    if (!document.getElementById('undoButton').disabled) {
                        e.preventDefault(); // Prevent browser's default undo (e.g., in text fields)
                        undo();
                    }
                }
            });

            // --- CUSTOM MAP CONTROLS ---
            document.getElementById('custom-zoom-in').addEventListener('click', () => {
                state.map.zoomIn();
            });
            document.getElementById('custom-zoom-out').addEventListener('click', () => {
                state.map.zoomOut();
            });
            document.getElementById('custom-reset-bearing').addEventListener('click', () => {
                state.map.easeTo({ bearing: 0, pitch: 0 });
            });
            const terrainButton = document.getElementById('custom-toggle-terrain');
            terrainButton.addEventListener('click', () => {
                if (state.map.getTerrain()) {
                    state.map.disableTerrain();
                } else {
                    state.map.enableTerrain(1.5);
                }
            });
            
            // Listen for the terrain event to update the button's active state
            state.map.on('terrain', (e) => {
                const terrainButton = document.getElementById('custom-toggle-terrain');
                if (e.terrain) { // e.terrain is true when terrain is enabled
                    terrainButton.classList.add('active');
                } else {
                    terrainButton.classList.remove('active');
                }
            });

            // Round Trip and Steep Uphill Toggles
            const roundTripButton = document.getElementById('custom-round-trip');
            const roundTripToggle = document.getElementById('roundTripToggle');
            const steepUphillButton = document.getElementById('custom-steep-uphill');
            const steepUphillToggle = document.getElementById('steepUphillToggle');

            roundTripButton.addEventListener('click', () => {
                roundTripToggle.click();
            });

            steepUphillButton.addEventListener('click', () => {
                steepUphillToggle.click();
            });

            roundTripToggle.addEventListener('change', (e) => {
                roundTripButton.classList.toggle('active', e.target.checked);
            });

            steepUphillToggle.addEventListener('change', (e) => {
                steepUphillButton.classList.toggle('active', e.target.checked);
            });

            // --- SEARCH FUNCTIONALITY ---
            const searchInput = document.getElementById('search-input');
            const suggestionsList = document.getElementById('search-suggestions');
            const debouncedSearch = debounce(fetchSearchSuggestions, 300);

            searchInput.addEventListener('input', () => {
                if (searchInput.value.trim().length >= 3) {
                    setSearchLoading(true);
                    debouncedSearch(searchInput.value);
                } else {
                    clearSuggestions();
                }
            });

            searchInput.addEventListener('keydown', handleSearchKeyDown);
            
            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (!suggestionsList.contains(document.activeElement)) {
                        clearSuggestions();
                    }
                }, 150);
            });

            searchInput.addEventListener('search', () => {
                if (!searchInput.value) {
                    clearSuggestions();
                }
            });
            
            document.getElementById('search-icon-container').addEventListener('click', () => {
                if (searchInput.value) {
                    searchInput.value = '';
                    clearSuggestions();
                    searchInput.focus();
                }
            });

            // Menu toggle functionality
            const menuToggle = document.getElementById('menuToggle');
            const menuPanel = document.getElementById('menuPanel');
            const menu_svg = '<svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>';
            const close_svg = '<svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>';
            
            menuToggle.addEventListener('click', () => {
                const isHidden = menuPanel.classList.contains('menu-hidden');
                if (isHidden) {
                    menuPanel.classList.remove('menu-hidden');
                    menuToggle.innerHTML = close_svg;
                } else {
                    menuPanel.classList.add('menu-hidden');
                    menuToggle.innerHTML = menu_svg;
                }
            });

            // Panel visibility buttons
            hidePanelButton.addEventListener('click', hideBottomPanel);
            showPanelButton.addEventListener('click', showBottomPanel);

            // Event listeners for the elevation highlight marker
            const bottomPanelEl = document.getElementById('bottomPanel');
            bottomPanelEl.addEventListener('mouseleave', () => {
                // Start a timer to remove the marker after 5 seconds
                if (state.highlightMarker) {
                    markerRemovalTimer = setTimeout(() => {
                        if (state.highlightMarker) {
                            state.highlightMarker.remove();
                            state.highlightMarker = null;
                        }
                        markerRemovalTimer = null;
                    }, 5000);
                }
            });

            bottomPanelEl.addEventListener('mouseenter', () => {
                // If the mouse re-enters, cancel the removal timer
                if (markerRemovalTimer) {
                    clearTimeout(markerRemovalTimer);
                    markerRemovalTimer = null;
                }
            });

            // Toggles listeners
            document.getElementById('roundTripToggle').addEventListener('change', handleRoundTripToggle);
            document.getElementById('steepUphillToggle').addEventListener('change', handleSteepUphillToggle);

                        window.addEventListener('resize', () => {

                            if (state.map) {

                                setTimeout(() => state.map.resize(), 100);

                            }

                            if (state.elevationChart) {

                                setTimeout(() => {

                                    state.elevationChart.resize();

                                }, 150);

                            }

                        });

            

                        // setupTooltips();

            

                        // Event listener for the "Add Waypoint" button

                        document.getElementById('addWaypointBtn').addEventListener('click', () => {

                            if (rightClickLatLng && insertIndex !== -1) {
                    addWaypoint(rightClickLatLng, insertIndex);
                    document.getElementById('contextMenu').classList.add('hidden');
                }
            });

            // Event listener for the "Remove Pin" button
            document.getElementById('removePinBtn').addEventListener('click', () => {
                if (rightClickedPinIndex !== -1) {
                    removePin(rightClickedPinIndex);
                    document.getElementById('contextMenu').classList.add('hidden');
                }
            });

            // Address Panel listeners
            const addressToggleContainer = document.getElementById('addressToggleContainer');
            const addressToggle = document.getElementById('addressToggle');
            const addressPanel = document.getElementById('addressPanel');
            const addressPanelClose = document.getElementById('addressPanelClose');

            addressToggle.addEventListener('click', () => {
                if (isDragging) { // This check is crucial
                    isDragging = false; // Reset flag for next interaction
                    return; // This was a drag, not a click. Ignore.
                }

                // Store the toggle's current position before showing the panel
                state.lastTogglePosition = {
                    top: addressToggleContainer.offsetTop,
                    left: addressToggleContainer.offsetLeft
                };
                // Reset the moved flag every time the panel is opened
                state.isAddressPanelMoved = false;

                // Reset panel size to default before showing
                addressPanel.style.width = '';
                addressPanel.style.height = '';

                // Position the panel at the toggle's location, with edge correction
                let newTop = state.lastTogglePosition.top;
                let newLeft = state.lastTogglePosition.left;

                const panelWidth = addressPanel.offsetWidth;
                const panelHeight = addressPanel.offsetHeight;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                if (newLeft + panelWidth > viewportWidth) {
                    newLeft = viewportWidth - panelWidth;
                }
                if (newTop + panelHeight > viewportHeight) {
                    newTop = viewportHeight - panelHeight;
                }
                if (newLeft < 0) newLeft = 0;
                if (newTop < 0) newTop = 0;

                addressPanel.style.top = newTop + 'px';
                addressPanel.style.left = newLeft + 'px';

                // Show panel, hide toggle button
                addressPanel.classList.remove('menu-hidden');
                addressToggleContainer.classList.add('hidden');

                state.isAddressPanelVisible = true;
                renderAddressList();
                // Use a short timeout to allow the browser to render the panel
                // before calculating its height.
                setTimeout(() => {
                    // First, auto-adjust the panel height based on content (up to 5 items)
                    adjustPanelHeightForContent();
                    // Then, ensure the inner list's max-height is correct for the new panel height
                    updateAddressListHeight();
                }, 50);
            });

            addressPanelClose.addEventListener('click', () => {
                let targetPosition;
                // If panel was not moved, use the toggle's last saved position
                if (!state.isAddressPanelMoved) {
                    targetPosition = {
                        top: state.lastTogglePosition.top,
                        left: state.lastTogglePosition.left
                    };
                } else {
                    // If panel was moved, use the panel's current position
                    targetPosition = {
                        top: addressPanel.offsetTop,
                        left: addressPanel.offsetLeft
                    };
                }

                // Position the toggle at the target location, with edge correction
                let newLeft = targetPosition.left;
                let newTop = targetPosition.top;

                const toggleWidth = addressToggleContainer.offsetWidth;
                const toggleHeight = addressToggleContainer.offsetHeight;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;

                if (newLeft + toggleWidth > viewportWidth) {
                    newLeft = viewportWidth - toggleWidth;
                }
                if (newTop + toggleHeight > viewportHeight) {
                    newTop = viewportHeight - toggleHeight;
                }
                if (newLeft < 0) newLeft = 0;
                if (newTop < 0) newTop = 0;
                
                addressToggleContainer.style.left = newLeft + 'px';
                addressToggleContainer.style.top = newTop + 'px';

                // Hide panel, show toggle button
                addressPanel.classList.add('menu-hidden');
                addressToggleContainer.classList.remove('hidden');

                state.isAddressPanelVisible = false;
            });

            // Left panel toggle
            const leftPanelContainer = document.getElementById('left-controls-container');
            const toggleLeftPanelButton = document.getElementById('toggle-left-panel-button');
            const left_arrow_svg = '<svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>';
            const right_arrow_svg = '<svg class="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>';

            toggleLeftPanelButton.addEventListener('click', () => {
                leftPanelContainer.classList.toggle('is-collapsed');
                const isCollapsed = leftPanelContainer.classList.contains('is-collapsed');
                if (isCollapsed) {
                    toggleLeftPanelButton.innerHTML = right_arrow_svg;
                    toggleLeftPanelButton.title = 'Εμφάνιση πίνακα';
                } else {
                    toggleLeftPanelButton.innerHTML = left_arrow_svg;
                    toggleLeftPanelButton.title = 'Απόκρυψη πίνακα';
                }
            });
        }
    
        
    


            
            // --- UNDO/HISTORY MANAGEMENT ---
            function saveState() {
                if (state.historyIndex < state.history.length - 1) {
                    state.history = state.history.slice(0, state.historyIndex + 1);
                }

                const snapshot = {
                    pins: state.pins.map(p => ({ lat: p.lat, lng: p.lng })),
                    isRoundTrip: state.isRoundTrip,
                    showSteepHighlight: state.showSteepHighlight
                };
                state.history.push(snapshot);
                state.historyIndex++;

                if (state.history.length > CONFIG.HISTORY_LIMIT + 1) {
                    state.history.shift();
                    state.historyIndex--;
                }
                
                updateUndoButton();
            }

            function undo() {
                if (state.historyIndex <= 0) return;
                state.historyIndex--;
                const previousState = state.history[state.historyIndex];
                restoreState(previousState);
            }
            
            function restoreState(snapshot) {
                // MapTiler uses LngLat object, which is compatible with {lng, lat}
                state.pins = snapshot.pins.map(p => new maptilersdk.LngLat(p.lng, p.lat));
                state.pinAddresses = state.pins.map(p => ({ status: 'empty', address: null, lngLat: p }));
                state.pinAddresses.forEach((_, index) => fetchAddressForPin(index));

                state.isRoundTrip = snapshot.isRoundTrip;
                state.showSteepHighlight = snapshot.showSteepHighlight ?? false;
                
                document.getElementById('roundTripToggle').checked = state.isRoundTrip;
                document.getElementById('steepUphillToggle').checked = state.showSteepHighlight;
                
                redrawFromState();
                updateUndoButton();
                setTimeout(adjustPanelHeightForContent, 50);
                syncCustomToggleButtons();
            }

            function redrawFromState() {
                // Remove existing markers from the map
                state.markers.forEach(marker => marker.remove());
                state.markers = [];
                
                // Clear route data from sources
                if (state.map.isStyleLoaded()) {
                    const routeSource = state.map.getSource('routeSource');
                    if (routeSource) routeSource.setData({ type: 'Feature', geometry: null });
                    
                    const steepSource = state.map.getSource('steepRouteSource');
                    if (steepSource) steepSource.setData({ type: 'FeatureCollection', features: [] });
                }
                
                // Re-add markers based on the new state
                state.pins.forEach((pin, index) => {
                    addMarker(pin, index + 1);
                });
                
                if (state.pins.length >= 2) {
                    calculateRoute();
                } else {
                    clearRoute(false); // This will also need refactoring
                }
                updateUIState();
                generateDefaultRouteName();
            }
            
            // --- SHARE & URL FUNCTIONALITY ---
            function generateShareLink() {
                if (state.pins.length === 0) return null;

                const pinString = state.pins.map(p => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
                const dataString = `v1|${pinString}|${state.isRoundTrip}|${state.showSteepHighlight}`;
                const compressed = LZString.compressToEncodedURIComponent(dataString);

                const baseUrl = window.location.href.split('#')[0];
                return `${baseUrl}#${compressed}`;
            }

            function copyShareLink() {
                const link = generateShareLink();
                if (!link) {
                    showMessage("Δημιουργήστε μια διαδρομή πρώτα.", 'error');
                    return;
                }

                navigator.clipboard.writeText(link).then(() => {
                    showMessage('Ο σύνδεσμος αντιγράφηκε στο πρόχειρο!', 'success');
                }).catch(err => {
                    console.error('Failed to copy link: ', err);
                    showMessage('Αποτυχία αντιγραφής. Ο σύνδεσμος είναι: ' + link, 'error');
                });
            }

            function parseUrlAndRestore() {
                const hash = window.location.hash.substring(1);
                if (!hash) return false;

                try {
                    const decompressed = LZString.decompressFromEncodedURIComponent(hash);
                    if (!decompressed || !decompressed.startsWith('v1|')) {
                        console.warn('Invalid or old share link format.');
                        return false;
                    }

                    const parts = decompressed.split('|');
                    parts.shift(); // remove "v1"

                    const showSteepHighlight = parts.pop() === 'true';
                    const isRoundTrip = parts.pop() === 'true';

                    const pins = parts.map(p => {
                        const coords = p.split(',');
                        // Return an object compatible with maptilersdk.LngLat
                        return { lat: parseFloat(coords[0]), lng: parseFloat(coords[1]) };
                    });

                    if (pins.length > 0) {
                        const snapshot = { 
                            pins: pins, 
                            isRoundTrip,
                            showSteepHighlight
                        };
                        state.history = [snapshot];
                        state.historyIndex = 0;
                        
                        // Wait for map to be loaded before restoring state
                        if (state.map.isStyleLoaded()) {
                            restoreState(snapshot);
                        } else {
                            state.map.once('load', () => restoreState(snapshot));
                        }
                        
                        console.log('Route restored from URL.');
                        return true;
                    }
                } catch (e) {
                    console.error("Failed to parse URL hash:", e);
                    showMessage("Ο σύνδεσμος της διαδρομής είναι κατεστραμμένος.", 'error');
                }
                return false;
            }

            // --- GPX Import/Export ---
            function downloadGPX() {
                if (state.pins.length === 0) {
                    showMessage('Δεν υπάρχουν σημεία για εξαγωγή.', 'error');
                    return;
                }

                let gpx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd" version="1.1" creator="WebApp Route Planner">
 <metadata>
  <name>Διαδρομή από WebApp</name>
  <time>${new Date().toISOString()}</time>
 </metadata>
`;

                // Add waypoints (user pins)
                state.pins.forEach((pin, index) => {
                    gpx += ` <wpt lat="${pin.lat}" lon="${pin.lng}">
  <name>Pin ${index + 1}</name>
 </wpt>
`;
                });

                // Add track if a route is calculated
                if (state.currentRoute && state.currentRoute.coordinates.length > 0) {
                    gpx += ` <trk>
  <name>Υπολογισμένη Διαδρομή</name>
  <trkseg>
`;
                    state.currentRoute.coordinates.forEach(coord => {
                        gpx += `   <trkpt lat="${coord[0]}" lon="${coord[1]}"><ele>${coord[2] || 0}</ele></trkpt>
`;
                    });
                    gpx += `  </trkseg>
 </trk>
`;
                }

                gpx += '</gpx>';

                const blob = new Blob([gpx], { type: 'application/gpx+xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `route_${new Date().toISOString().split('T')[0]}.gpx`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showMessage('Η λήψη του GPX ξεκίνησε.', 'success');
            }

            function handleGpxFileUpload(event) {
                const file = event.target.files[0];
                if (!file) {
                    return;
                }

                if (!file.name.toLowerCase().endsWith('.gpx')) {
                    showMessage('Παρακαλώ επιλέξτε ένα αρχείο GPX (.gpx).', 'error');
                    event.target.value = ''; // Reset file input
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const gpxContent = e.target.result;
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(gpxContent, "text/xml");

                        if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
                            throw new Error("Μη έγκυρη δομή GPX.");
                        }

                        const waypoints = xmlDoc.querySelectorAll('wpt');
                        let newPins = [];

                        if (waypoints.length > 0) {
                            for (let i = 0; i < waypoints.length; i++) {
                                const lat = waypoints[i].getAttribute('lat');
                                const lon = waypoints[i].getAttribute('lon');
                                if (lat && lon) {
                                    newPins.push(new maptilersdk.LngLat(parseFloat(lon), parseFloat(lat)));
                                }
                            }
                        }

                        if (newPins.length === 0) {
                            throw new Error("Δεν βρέθηκαν αποθηκευμένα pins (waypoints) στο αρχείο GPX.");
                        }
                        
                        if (newPins.length > CONFIG.MAX_PINS) {
                            showMessage(`Το αρχείο περιέχει ${newPins.length} σημεία. Φορτώθηκαν τα πρώτα ${CONFIG.MAX_PINS}.`, 'warning');
                            newPins = newPins.slice(0, CONFIG.MAX_PINS);
                        }

                        clearRoute(true); // Clear everything before loading
                        state.pins = newPins;
                        state.pinAddresses = state.pins.map(p => ({ status: 'empty', address: null, lngLat: p }));
                        state.pinAddresses.forEach((_, index) => fetchAddressForPin(index));

                        redrawFromState();
                        saveState();
                        showMessage(`Η διαδρομή από το αρχείο GPX φορτώθηκε με ${newPins.length} σημεία.`, 'success');
                        setTimeout(adjustPanelHeightForContent, 50);

                    } catch (error) {
                        console.error("GPX parsing error:", error);
                        showMessage(`Σφάλμα κατά την επεξεργασία του αρχείου GPX: ${error.message}`, 'error');
                    } finally {
                        event.target.value = '';
                    }
                };
                reader.readAsText(file);
            }


            // --- MAP INTERACTION ---
            function handleMapClick(e) {
                // Prevent clicks when interacting with a marker
                if (e.originalEvent.target.closest('.maptiler-marker')) {
                    return;
                }

                if (state.pins.length >= CONFIG.MAX_PINS) {
                    showMessage(`Επιτρέπονται μέχρι ${CONFIG.MAX_PINS} σημεία.`, 'error');
                    return;
                }
                
                const latlng = e.lngLat;
                state.pins.push(latlng);
                state.pinAddresses.push({ status: 'empty', address: null, lngLat: latlng });
                fetchAddressForPin(state.pins.length - 1);

                addMarker(latlng, state.pins.length);
                
                if (state.pins.length >= 2) {
                    calculateRoute();
                }
                saveState();
                updateUIState();
                adjustPanelHeightForContent();
            }
            
            function handleMapRightClick(e) {
                e.preventDefault();
                
                rightClickLatLng = e.lngLat;
                // findBestWaypointInsertIndex will need refactoring to use LngLat
                insertIndex = findBestWaypointInsertIndex(rightClickLatLng);
                rightClickedPinIndex = -1; // Reset pin index

                const addWaypointBtn = document.getElementById('addWaypointBtn');
                const removePinBtn = document.getElementById('removePinBtn');
                addWaypointBtn.style.display = 'flex';
                removePinBtn.style.display = 'none';

                const contextMenu = document.getElementById('contextMenu');
                
                contextMenu.style.visibility = 'hidden';
                contextMenu.classList.remove('hidden');
                const menuWidth = contextMenu.offsetWidth;
                const menuHeight = contextMenu.offsetHeight;
                contextMenu.classList.add('hidden');
                contextMenu.style.visibility = 'visible';

                let x = e.originalEvent.clientX;
                let y = e.originalEvent.clientY;

                if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
                if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
                if (x < 0) x = 0;
                if (y < 0) y = 0;

                contextMenu.style.left = `${x}px`;
                contextMenu.style.top = `${y}px`;
                contextMenu.classList.remove('hidden');

                const hideMenu = (event) => {
                    if (!contextMenu.contains(event.target) && event.button !== 2) {
                        contextMenu.classList.add('hidden');
                        document.removeEventListener('click', hideMenu);
                        document.removeEventListener('contextmenu', hideMenu);
                    }
                };
                document.addEventListener('click', hideMenu);
                document.addEventListener('contextmenu', hideMenu);
            }

            function handleMarkerRightClick(e, markerIndex) {
                e.preventDefault();
                e.stopPropagation();

                rightClickedPinIndex = markerIndex;
                if (rightClickedPinIndex === -1) return;

                const addWaypointBtn = document.getElementById('addWaypointBtn');
                const removePinBtn = document.getElementById('removePinBtn');
                addWaypointBtn.style.display = 'none';
                removePinBtn.style.display = 'flex';

                const contextMenu = document.getElementById('contextMenu');
                
                contextMenu.style.visibility = 'hidden';
                contextMenu.classList.remove('hidden');
                const menuWidth = contextMenu.offsetWidth;
                const menuHeight = contextMenu.offsetHeight;
                contextMenu.classList.add('hidden');
                contextMenu.style.visibility = 'visible';

                let x = e.clientX;
                let y = e.clientY;

                if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
                if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
                if (x < 0) x = 0;
                if (y < 0) y = 0;

                contextMenu.style.left = `${x}px`;
                contextMenu.style.top = `${y}px`;
                contextMenu.classList.remove('hidden');

                const hideMenu = (event) => {
                    if (!contextMenu.contains(event.target) && event.button !== 2) {
                        contextMenu.classList.add('hidden');
                        document.removeEventListener('click', hideMenu);
                        document.removeEventListener('contextmenu', hideMenu);
                    }
                };
                document.addEventListener('click', hideMenu);
                document.addEventListener('contextmenu', hideMenu);
            }

            function addWaypoint(latlng, index) {
                if (state.pins.length >= CONFIG.MAX_PINS) {
                    showMessage(`Επιτρέπονται μέχρι ${CONFIG.MAX_PINS} σημεία.`, 'error');
                    return;
                }

                state.pins.splice(index, 0, latlng);
                state.pinAddresses.splice(index, 0, { status: 'empty', address: null, lngLat: latlng });
                fetchAddressForPin(index);
                
                redrawFromState(); // Easiest way to re-number and re-draw everything
                saveState();
                updateUIState();
            }

            function addMarker(lngLat, number) {
                const el = createNumberedIcon(number, number === 1);
                
                const marker = new maptilersdk.Marker({element: el, draggable: true})
                    .setLngLat(lngLat)
                    .addTo(state.map);
                
                const index = state.markers.length; // Index before pushing
                
                marker.getElement().addEventListener('contextmenu', (e) => handleMarkerRightClick(e, index));

                marker.on('dragend', () => {
                    const markerIndex = state.markers.indexOf(marker);
                    if (markerIndex > -1) {
                        const newLngLat = marker.getLngLat();
                        state.pins[markerIndex] = newLngLat;
                        
                        // Update address state and refetch
                        if(state.pinAddresses[markerIndex]) {
                            state.pinAddresses[markerIndex].lngLat = newLngLat;
                            fetchAddressForPin(markerIndex, true); // Force refetch for new location
                        }

                        if (state.pins.length >= 2) calculateRoute();
                        saveState();
                    }
                });
                
                state.markers.push(marker);
                updateFirstMarkerIcon();
            }

            function removePin(index) {
                if (index < 0 || index >= state.pins.length) return;
                
                state.markers[index].remove();
                state.pins.splice(index, 1);
                state.pinAddresses.splice(index, 1); // Remove address
                state.markers.splice(index, 1);
                
                renderAddressList(); // Update address list UI

                // Re-draw everything to update numbers correctly
                redrawFromState();
                saveState();
                updateUIState();
            }

            function createNumberedIcon(number, isStart = false) {
                const el = document.createElement('div');
                el.className = 'pin-icon';
                
                if (isStart) {
                    el.classList.add('start');
                    if (state.isRoundTrip && state.pins.length > 1) {
                        el.classList.add('flag');
                        el.innerHTML = '🏁';
                    } else {
                        el.innerHTML = number.toString();
                    }
                } else {
                    el.innerHTML = number.toString();
                }
                return el;
            }

            function updateFirstMarkerIcon() {
                if (state.markers.length > 0) {
                    const firstMarker = state.markers[0];
                    const el = firstMarker.getElement();
                    const isRoundTrip = state.isRoundTrip && state.pins.length > 1;

                    el.innerHTML = isRoundTrip ? '🏁' : '1';
                    el.classList.toggle('flag', isRoundTrip);
                }
            }

            function handleRoundTripToggle(e) {
                state.isRoundTrip = e.target.checked;
                updateFirstMarkerIcon();
                if (state.pins.length >= 2) {
                    calculateRoute();
                } else if (!state.isRoundTrip) {
                    clearRoute(false);
                }
                saveState();
            }

            function handleSteepUphillToggle(e) {
                state.showSteepHighlight = e.target.checked;
                if (state.map.isStyleLoaded() && state.map.getLayer('steepRouteLayer')) {
                    state.map.setPaintProperty('steepRouteLayer', 'line-opacity', state.showSteepHighlight ? 0.8 : 0);
                }
                saveState();
            }
            
            // --- LOCATION SEARCH LOGIC ---
            function getConciseLocationName(item) {
                // MapTiler features have a 'text' property for the main name
                // and 'place_name' for the full address.
                // We prefer the 'text' property for a concise name.
                return item.text || item.place_name;
            }

            async function fetchSearchSuggestions(query) {
                const trimmedQuery = query.trim();
                if (!trimmedQuery) {
                    clearSuggestions();
                    setSearchLoading(false);
                    return;
                }

                // Regex to detect "lat, lon" or "lat lon" patterns
                const coordRegex = /^\s*(-?\d{1,2}(\.\d+)?)\s*[, ]\s*(-?\d{1,3}(\.\d+)?)\s*$/;
                const match = trimmedQuery.match(coordRegex);

                if (match) {
                    setSearchLoading(true);
                    try {
                        const lat = parseFloat(match[1]);
                        const lon = parseFloat(match[3]);

                        // Validate coordinate ranges
                        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
                            // Manually create a GeoJSON-like feature
                            const customFeature = {
                                id: 'custom-coordinate-' + Date.now(),
                                type: 'Feature',
                                place_name: `Συντεταγμένες: ${lat.toFixed(5)}, ${lon.toFixed(5)}`,
                                text: 'Επιλεγμένες Συντεταγμένες',
                                center: [lon, lat],
                                geometry: {
                                    type: 'Point',
                                    coordinates: [lon, lat]
                                },
                                properties: {}
                            };
                            
                            state.searchSuggestions = [customFeature];
                            renderSuggestions([customFeature]);
                        } else {
                            clearSuggestions(); // Invalid coordinates
                        }
                    } catch (e) {
                        clearSuggestions();
                    } finally {
                        setSearchLoading(false);
                    }
                    return; // Stop here for coordinate input
                }


                // If not a coordinate, proceed with the text search
                try {
                    // Construct the URL for MapTiler Geocoding API
                    const proximity = state.map.getCenter();
                    const proximityParam = `&proximity=${proximity.lng},${proximity.lat}`;
                    const url = `/api/maptiler/geocoding/${encodeURIComponent(trimmedQuery)}.json?country=GR&language=el&limit=5${proximityParam}`;

                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Η υπηρεσία αναζήτησης MapTiler δεν είναι διαθέσιμη.');
                    
                    const results = await response.json();

                    if (!results || !results.features) throw new Error('Δεν βρέθηκαν αποτελέσματα.');
                    
                    state.searchSuggestions = results.features;
                    renderSuggestions(results.features);
                } catch (error) {
                    console.error('Search error:', error);
                    clearSuggestions();
                } finally {
                    setSearchLoading(false);
                }
            }

            // MODIFIED: Added hover tooltips to search results
            function renderSuggestions(suggestions) {
                const suggestionsList = document.getElementById('search-suggestions');
                suggestionsList.innerHTML = '';
                suggestionsList.classList.remove('hidden');

                if (suggestions.length === 0) {
                    suggestionsList.innerHTML = `<li class="text-gray-500 italic">Δεν βρέθηκαν αποτελέσματα</li>`;
                    return;
                }

                suggestions.forEach((item, index) => {
                    const li = document.createElement('li');
                    li.textContent = getConciseLocationName(item);
                    li.dataset.index = index;
                    li.addEventListener('click', () => selectSuggestion(item));
                    
                    // NEW: Add mouseenter and mouseleave events for the tooltip
                    li.addEventListener('mouseenter', (e) => {
                        if (activeSearchTooltip) activeSearchTooltip.remove();

                        const currentItem = state.searchSuggestions[parseInt(e.currentTarget.dataset.index)];
                        if (!currentItem) return;

                        activeSearchTooltip = document.createElement('div');
                        activeSearchTooltip.className = 'search-result-tooltip';
                        activeSearchTooltip.innerHTML = currentItem.place_name;
                        document.body.appendChild(activeSearchTooltip);

                        const rect = e.currentTarget.getBoundingClientRect();
                        activeSearchTooltip.style.top = `${rect.top}px`;
                        activeSearchTooltip.style.left = `${rect.right + 10}px`;

                        const tooltipRect = activeSearchTooltip.getBoundingClientRect();
                        if (tooltipRect.right > window.innerWidth) {
                            activeSearchTooltip.style.left = `${rect.left - tooltipRect.width - 10}px`;
                        }
                        
                        setTimeout(() => {
                            if (activeSearchTooltip) activeSearchTooltip.style.opacity = '1';
                        }, 50);
                    });

                    li.addEventListener('mouseleave', () => {
                        if (activeSearchTooltip) {
                            activeSearchTooltip.style.opacity = '0';
                            setTimeout(() => {
                                if (activeSearchTooltip) activeSearchTooltip.remove();
                                activeSearchTooltip = null;
                            }, 200);
                        }
                    });

                    suggestionsList.appendChild(li);
                });
                state.highlightedSuggestionIndex = -1;
            }

            function selectSuggestion(item) {
                // item is a GeoJSON feature from MapTiler
                const lon = item.center[0];
                const lat = item.center[1];
                
                if (state.searchResultMarker) {
                    state.searchResultMarker.remove();
                }
                
                state.map.flyTo({ center: [lon, lat], zoom: 15 });

                const popup = new maptilersdk.Popup({ offset: 25, closeButton: false })
                    .setHTML(`<b>${item.place_name}</b>`); // Use place_name for the full address

                state.searchResultMarker = new maptilersdk.Marker({color: "#FF0000"})
                  .setLngLat([lon, lat])
                  .setPopup(popup)
                  .addTo(state.map)
                  .togglePopup();

                document.getElementById('search-input').value = getConciseLocationName(item);
                clearSuggestions();
            }

            function handleSearchKeyDown(e) {
                const suggestionsList = document.getElementById('search-suggestions');
                const items = suggestionsList.querySelectorAll('li');
                if (items.length === 0) return;

                switch (e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        state.highlightedSuggestionIndex = (state.highlightedSuggestionIndex + 1) % items.length;
                        updateSuggestionHighlight();
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        state.highlightedSuggestionIndex = (state.highlightedSuggestionIndex - 1 + items.length) % items.length;
                        updateSuggestionHighlight();
                        break;
                    case 'Enter':
                        e.preventDefault();
                        if (state.highlightedSuggestionIndex > -1) {
                            selectSuggestion(state.searchSuggestions[state.highlightedSuggestionIndex]);
                        }
                        break;
                    case 'Escape':
                        clearSuggestions();
                        break;
                }
            }

            function updateSuggestionHighlight() {
                const items = document.getElementById('search-suggestions').querySelectorAll('li');
                items.forEach((item, index) => {
                    if (index === state.highlightedSuggestionIndex) {
                        item.classList.add('highlighted');
                        item.scrollIntoView({ block: 'nearest' });
                    } else {
                        item.classList.remove('highlighted');
                    }
                });
            }
            
            // MODIFIED: Cleans up the tooltip when suggestions are cleared
            function clearSuggestions() {
                const suggestionsList = document.getElementById('search-suggestions');
                suggestionsList.innerHTML = '';
                suggestionsList.classList.add('hidden');
                state.searchSuggestions = [];
                state.highlightedSuggestionIndex = -1;
                
                if (activeSearchTooltip) {
                    activeSearchTooltip.remove();
                    activeSearchTooltip = null;
                }
            }

            function setSearchLoading(isLoading) {
                state.isSearchLoading = isLoading;
                document.getElementById('search-spinner').classList.toggle('hidden', !isLoading);
                document.getElementById('search-magnifying-glass').classList.toggle('hidden', isLoading);
            }

            // --- OLD, CONFLICTING ADDRESS LOGIC REMOVED ---

            // --- ROUTE & ELEVATION CALCULATION ---
            async function calculateRoute() {
                let pinsForRoute = [...state.pins];
                if (state.isRoundTrip && pinsForRoute.length >= 2) {
                    pinsForRoute.push(pinsForRoute[0]);
                }

                if (pinsForRoute.length < 2) {
                    clearRoute(false);
                    return;
                }
                
                showLoading(true);

                try {
                    let routeData = null;
                    const apis = [() => fetchFromORS(pinsForRoute), () => fetchFromGraphHopper(pinsForRoute)];

                    for (const fetchFunc of apis) {
                        try {
                            routeData = await fetchFunc();
                            if (routeData) break;
                        } catch (error) {
                            console.warn(`${fetchFunc.name} failed:`, error.message);
                        }
                    }

                    if (!routeData) throw new Error('Όλες οι υπηρεσίες δρομολόγησης απέτυχαν.');

                    // More robust check for elevation data
                    const hasInvalidElevation = !routeData.coordinates?.[0] || routeData.coordinates[0].length < 3 || typeof routeData.coordinates[0][2] !== 'number';

                    if (hasInvalidElevation) {
                        console.log("Routing service did not provide valid elevation. Fetching separately...");
                        // Ensure coordinates are 2D before fetching elevation
                        const twoDCoords = routeData.coordinates.map(c => [c[0], c[1]]);
                        const elevations = await fetchElevationSeparately(twoDCoords);
                        
                        // Rebuild coordinates array with new elevations
                        routeData.coordinates = twoDCoords.map((coord, index) => {
                            return [coord[0], coord[1], elevations[index] || 0];
                        });
                    }
                    
                    state.currentRoute = routeData;
                    processElevationData(routeData.coordinates);

                } catch (error) {
                    showMessage(error.message, 'error');
                    console.error('Route calculation error:', error);
                } finally {
                    showLoading(false);
                }
            }

            async function fetchFromORS(pins) {
                console.log("Attempting to fetch route from OpenRouteService...");
                const coordinates = pins.map(pin => [pin.lng, pin.lat]);
                            const response = await fetch('/api/ors/v2/directions/driving-car/geojson', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    coordinates: coordinates,
                                    instructions: false,
                                    elevation: true
                                })
                            });

                if (!response.ok) throw new Error(`ORS API error: ${response.status}`);
                const data = await response.json();
                if (!data.features?.[0]) throw new Error('Δεν βρέθηκε διαδρομή από το ORS');
                
                const route = data.features[0];
                console.log("Success from OpenRouteService.");
                return {
                    coordinates: route.geometry.coordinates.map(c => [c[1], c[0], c[2]]), // lat, lng, elevation
                    distance: route.properties.summary?.distance || 0,
                };
            }

            async function fetchFromGraphHopper(pins) {
                console.log("Attempting to fetch route from GraphHopper (direct client call)...");
                const points = pins.map(pin => `point=${pin.lat},${pin.lng}`).join('&');
                const url = `https://graphhopper.com/api/1/route?${points}&vehicle=car&calc_points=true&points_encoded=false&type=json&elevation=true&key=${CONFIG.GRAPHHOPPER_PUBLIC_KEY}`;
                
                const response = await fetch(url);
                if (!response.ok) throw new Error(`GraphHopper API error: ${response.status}`);
                const data = await response.json();
                if (!data.paths?.[0]) throw new Error('Δεν βρέθηκε διαδρομή από το GraphHopper');

                const path = data.paths[0];
                console.log("Success from GraphHopper.");
                return {
                    coordinates: path.points.coordinates.map(c => [c[1], c[0], c[2]]), // lat, lng, elevation
                    distance: path.distance,
                };
            }

            async function fetchElevationSeparately(coordinates) {
                const maxPoints = 300;
                let pointsToFetch = coordinates;
                if (coordinates.length > maxPoints) {
                    pointsToFetch = [];
                    const step = Math.floor(coordinates.length / maxPoints);
                    for (let i = 0; i < coordinates.length; i += step) {
                        pointsToFetch.push(coordinates[i]);
                    }
                }

                const response = await fetch(CONFIG.ELEVATION_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        locations: pointsToFetch.map(c => ({ latitude: c[0], longitude: c[1] }))
                    })
                });
                if (!response.ok) throw new Error('Elevation API failed');
                const data = await response.json();
                const elevations = data.results.map(r => r.elevation);

                if (coordinates.length > maxPoints) {
                    const fullElevations = [];
                    for(let i = 0; i < coordinates.length; i++) {
                        const step = Math.floor(coordinates.length / maxPoints);
                        const prevIndex = Math.floor(i / step);
                        const nextIndex = Math.min(prevIndex + 1, elevations.length - 1);
                        
                        if (prevIndex === nextIndex) {
                            fullElevations.push(elevations[prevIndex]);
                            continue;
                        }

                        const prevElev = elevations[prevIndex];
                        const nextElev = elevations[nextIndex];
                        const ratio = (i % step) / step;
                        fullElevations.push(prevElev + (nextElev - prevElev) * ratio);
                    }
                    return fullElevations;
                }
                return elevations;
            }
            
                            function processElevationData(routeCoordinates) {
                                let cumulativeDistance = 0;
                                let elevationGain = 0;
                                let steepUphillDistance = 0;
                                const elevationProfileData = [];
                                
                                routeCoordinates.forEach((point, index) => {
                                    const elevation = point[2];
                                    let isSteepSegment = false;
                                    if (index > 0) {
                                        const prevPoint = routeCoordinates[index - 1];
                                        const segmentDistance = calculateHaversineDistance(prevPoint, point);
                                        cumulativeDistance += segmentDistance;
                    
                                        const elevationDiff = elevation - (prevPoint[2] || 0);
                                        if (elevationDiff > 0) elevationGain += elevationDiff;
                    
                                        // Check for steep uphill slope
                                        if (segmentDistance > 0) {
                                            const gradient = elevationDiff / segmentDistance;
                                            if (gradient > CONFIG.STEEP_GRADIENT_THRESHOLD) {
                                                isSteepSegment = true;
                                                if (elevationDiff > 0) { // Only count uphill steep segments
                                                    steepUphillDistance += segmentDistance;
                                                }
                                            }
                                        }
                                    }
                                    elevationProfileData.push({ distance: cumulativeDistance, elevation: elevation, isSteep: isSteepSegment });
                                });
                    
                                const maxChartPoints = 300;
                                let sampledElevationData = elevationProfileData;
                                let sampledRouteCoords = routeCoordinates;
                    
                                if (elevationProfileData.length > maxChartPoints) {
                                    sampledElevationData = [];
                                    sampledRouteCoords = [];
                                    const step = Math.floor(elevationProfileData.length / maxChartPoints);
                                    for (let i = 0; i < elevationProfileData.length; i += step) {
                                        sampledElevationData.push(elevationProfileData[i]);
                                        sampledRouteCoords.push(routeCoordinates[i]);
                                    }
                                }
                    
                                state.currentElevation = { data: sampledElevationData, coordinates: sampledRouteCoords };
                    
                                updateRouteStats({ distance: cumulativeDistance, elevationGain, steepUphillDistance });
                                displayColoredRoute(routeCoordinates);
                                displayElevationChart(sampledElevationData);
                                updateStatsVisibility(true);
                                showBottomPanel();
                            }
                                            // --- UI UPDATES & DISPLAY ---
                                            function showBottomPanel() {
                                                if (!state.currentRoute) return;
                    
                                                // Only trigger the shine animation if the panel is not already visible.
                                                if (!bottomPanel.classList.contains('is-visible')) {
                                                    // Add the class to trigger the shine animation
                                                    bottomPanel.classList.add('is-opening');
                                                    
                                                    // Remove the animation class after it has finished
                                                    // Animation duration is 3.5s with no delay, so total 3.5s
                                                    setTimeout(() => {
                                                        bottomPanel.classList.remove('is-opening');
                                                    }, 3500);
                                                }
                                                
                                                bottomPanel.classList.add('is-visible');
                                                showPanelButton.classList.toggle('hidden', bottomPanel.classList.contains('is-visible'));
                                            }
                                    
                                            function hideBottomPanel() {
                                                bottomPanel.classList.remove('is-visible');
                                                if (state.currentRoute) {
                                                    showPanelButton.classList.remove('hidden');
                                                }
                                            }
                                    
                                            function displayColoredRoute(routeCoordinates) {
                                                if (!state.map.isStyleLoaded()) {
                                                    state.map.once('styledata', () => displayColoredRoute(routeCoordinates));
                                                    return;
                                                }
                                                // routeCoordinates are [lat, lng, ele]
                                                // GeoJSON is [lng, lat]
                                                const geojsonCoordinates = routeCoordinates.map(c => [c[1], c[0]]);
                    
                                                // 1. Update the main route source
                                                const routeSource = state.map.getSource('routeSource');
                                                if (routeSource) {
                                                    routeSource.setData({
                                                        type: 'Feature',
                                                        geometry: {
                                                            type: 'LineString',
                                                            coordinates: geojsonCoordinates
                                                        }
                                                    });
                                                }
                    
                                                // 2. Create and update the steep segments source
                                                const steepSegments = [];
                                                let currentSteepSegment = [];
                                                for (let i = 1; i < routeCoordinates.length; i++) {
                                                    const startPoint = routeCoordinates[i - 1];
                                                    const endPoint = routeCoordinates[i];
                                                    const segmentDistance = calculateHaversineDistance(startPoint, endPoint);
                                                    const elevationDiff = endPoint[2] - startPoint[2];
                                                    
                                                    if (segmentDistance > 0) {
                                                        const gradient = elevationDiff / segmentDistance;
                                                        if (gradient > CONFIG.STEEP_GRADIENT_THRESHOLD && elevationDiff > 0) {
                                                            if (currentSteepSegment.length === 0) {
                                                                currentSteepSegment.push([startPoint[1], startPoint[0]]);
                                                            }
                                                            currentSteepSegment.push([endPoint[1], endPoint[0]]);
                                                        } else {
                                                            if (currentSteepSegment.length > 1) {
                                                                steepSegments.push({
                                                                    type: 'Feature',
                                                                    properties: {},
                                                                    geometry: { type: 'LineString', coordinates: currentSteepSegment }
                                                                });
                                                            }
                                                            currentSteepSegment = [];
                                                        }
                                                    }
                                                }
                                                if (currentSteepSegment.length > 1) {
                                                    steepSegments.push({
                                                        type: 'Feature',
                                                        properties: {},
                                                        geometry: { type: 'LineString', coordinates: currentSteepSegment }
                                                    });
                                                }
                    
                                                const steepSource = state.map.getSource('steepRouteSource');
                                                if (steepSource) {
                                                    steepSource.setData({
                                                        type: 'FeatureCollection',
                                                        features: steepSegments
                                                    });
                                                }
                                                
                                                // 3. Set visibility of the steep layer
                                                if (state.map.getLayer('steepRouteLayer')) {
                                                    state.map.setPaintProperty('steepRouteLayer', 'line-opacity', state.showSteepHighlight ? 0.8 : 0);
                                                }
                    
                                                                                                 // 5. Zoom map to fit the route
                                                                                                if (geojsonCoordinates.length > 0) {
                                                                                                    const bounds = new maptilersdk.LngLatBounds(geojsonCoordinates[0], geojsonCoordinates[0]);
                                                                                                    for (const coord of geojsonCoordinates) {
                                                                                                        bounds.extend(coord);
                                                                                                    }
                                                                                                    state.map.fitBounds(bounds, { padding: 80, duration: 1000 });
                                                                                                }
                                                                                            }                                    
                                            function updateRouteStats(data) {
                                                const formatDistance = (d) => d > 1000 ? `${(d / 1000).toFixed(2)} km` : `${Math.round(d)} m`;
                                                
                                                document.getElementById('totalDistance').textContent = formatDistance(data.distance);
                                                document.getElementById('steepUphillDistance').textContent = formatDistance(data.steepUphillDistance);
                                                document.getElementById('elevationGain').textContent = `+${Math.round(data.elevationGain)} m`;
                                            }
                                            
                                            async function displayElevationChart(elevationData) {
                                                try {
                                                    await loadChartJs();
                                                } catch {
                                                    showMessage('Αποτυχία φόρτωσης του γραφήματος.', 'error');
                                                    return;
                                                }
                                    
                                                const ctx = document.getElementById('elevationChart').getContext('2d');
                                                if (state.elevationChart) state.elevationChart.destroy();
                                                document.getElementById('no-elevation-message').style.display = 'none';
                                    
                                                const labels = elevationData.map(d => (d.distance / 1000).toFixed(2));
                                                const elevations = elevationData.map(d => d.elevation);
                                    
                                                state.elevationChart = new Chart(ctx, {
                                                    type: 'line',
                                                    data: {
                                                        labels: labels,
                                                        datasets: [{
                                                            label: 'Υψόμετρο (m)',
                                                            data: elevations,
                                                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                                            borderWidth: 2,
                                                            fill: true,
                                                            pointRadius: 0,
                                                            pointHoverRadius: 5,
                                                            tension: 0.1,
                                                            segment: {
                                                                borderColor: ctx => {
                                                                    const index = ctx.p1DataIndex; // ctx.p1DataIndex refers to the end point of the segment
                                                                    const point = elevationData[index];
                                                                    return point && point.isSteep ? '#FF0000' : '#3B82F6';
                                                                }
                                                            }
                                                        }]
                                                    },
                                                    options: {
                                                        responsive: true, maintainAspectRatio: false, 
                                                        interaction: { intersect: false, mode: 'index' },
                                                        scales: {
                                                            x: { title: { display: true, text: 'Απόσταση (km)' }, ticks: { autoSkip: true, maxTicksLimit: 10 } },
                                                            y: { title: { display: true, text: 'Υψόμετρο (m)' } }
                                                        },
                                                        plugins: {
                                                            legend: { display: false },
                                                            tooltip: {
                                                                callbacks: {
                                                                    title: (ctx) => `Απόσταση: ${ctx[0].label} km`,
                                                                    label: (ctx) => `Υψόμετρο: ${Math.round(ctx.raw)} m`
                                                                }
                                                            }
                                                        },
                                                        onHover: (event, chartElement) => {
                                                            if (chartElement.length > 0) {
                                                                const index = chartElement[0].index;
                                                                const coord = state.currentElevation.coordinates[index];
                                                                if (coord) {
                                                                    const lngLat = [coord[1], coord[0]]; // MapTiler is Lng, Lat
                                                                    if (!state.highlightMarker) {
                                                                        // Use a blue marker that matches the app's theme
                                                                        state.highlightMarker = new maptilersdk.Marker({ color: '#3B82F6' })
                                                                            .setLngLat(lngLat)
                                                                            .addTo(state.map);
                                                                    } else {
                                                                        state.highlightMarker.setLngLat(lngLat);
                                                                    }
                                                                }
                                                            } else if (state.highlightMarker) {
                                                                state.highlightMarker.remove();
                                                                state.highlightMarker = null;
                                                            }
                                                        }
                                                    }
                                                });
                                    
                    
                                            }
                                            
                                            // --- UTILITY & HELPER FUNCTIONS ---
                                            function clearRoute(clearPins) {
                                                if (clearPins) {
                                                    state.markers.forEach(marker => marker.remove());
                                                    state.markers = [];
                                                    state.pins = [];
                                                                        document.getElementById('roundTripToggle').checked = false;
                                                                        state.isRoundTrip = false;
                                                                        document.getElementById('steepUphillToggle').checked = false;
                                                                        state.showSteepHighlight = false;
                                                                        syncCustomToggleButtons();
                                                                        
                                                                        // Reset route name state                                                    state.routeName = '';
                                                    state.isRouteNameUserModified = false;
                                                    generateDefaultRouteName();
                    
                                                    state.history = [];
                                                    state.historyIndex = -1;
                                                    saveState();
                                                }
                                                
                                                // Clear the route data from the map sources
                                                if (state.map.isStyleLoaded()) {
                                                    const routeSource = state.map.getSource('routeSource');
                                                    if (routeSource) routeSource.setData({ type: 'Feature', geometry: null });
                                                    
                                                                                                         const steepSource = state.map.getSource('steepRouteSource');
                                                                                                        if (steepSource) steepSource.setData({ type: 'FeatureCollection', features: [] });
                                                                                                    }
                                                                                                    
                                                                                                    if (state.elevationChart) {                                                    state.elevationChart.destroy();
                                                    state.elevationChart = null;
                                                }
                                                if (state.highlightMarker) {
                                                    state.highlightMarker.remove();
                                                    state.highlightMarker = null;
                                                }
                                                if (state.searchResultMarker) {
                                                    state.searchResultMarker.remove();
                                                    state.searchResultMarker = null;
                                                }
                                                
                                                state.currentRoute = null;
                                                state.currentElevation = { data: [], coordinates: [] };
                                                
                                                hideBottomPanel();
                                                updateStatsVisibility(false);
                                                document.getElementById('no-elevation-message').style.display = 'flex';
                                                updateUIState();
                                            }
                                    
                                    
                                            
                                            function generateGPX(route) {
                                                const timestamp = new Date().toISOString();
                                                let gpx = `<?xml version="1.0" encoding="UTF-8"?>
                <gpx version="1.1" creator="Route Planner" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
                  <metadata><time>${timestamp}</time></metadata>
                  <trk><name>Planned Route</name><trkseg>`;
                                                
                                                route.coordinates.forEach(coord => {
                                                    gpx += `\n      <trkpt lat="${coord[0]}" lon="${coord[1]}"><ele>${coord[2] || 0}</ele></trkpt>`;
                                                });
                                                
                                                gpx += `\n    </trkseg></trk></gpx>`;
                                                return gpx;
                                            }
                                    
                                            function calculateHaversineDistance(coords1, coords2) {
                                                const R = 6371e3; // metres
                                                const φ1 = coords1[0] * Math.PI/180;
                                                const φ2 = coords2[0] * Math.PI/180;
                                                const Δφ = (coords2[0]-coords1[0]) * Math.PI/180;
                                                const Δλ = (coords2[1]-coords1[1]) * Math.PI/180;
                                    
                                                const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
                                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                                                return R * c;
                                            }
                    
                                            function haversineDistanceObjects(lngLat1, lngLat2) {
                                                const R = 6371e3; // metres
                                                const φ1 = lngLat1.lat * Math.PI / 180;
                                                const φ2 = lngLat2.lat * Math.PI / 180;
                                                const Δφ = (lngLat2.lat - lngLat1.lat) * Math.PI / 180;
                                                const Δλ = (lngLat2.lng - lngLat1.lng) * Math.PI / 180;
                    
                                                const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                                                          Math.cos(φ1) * Math.cos(φ2) *
                                                          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
                                                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    
                                                return R * c; // in metres
                                            }
                                    
                                            // Re-implemented to remove Leaflet dependencies
                                            function findBestWaypointInsertIndex(newLatLng) {
                                                if (state.pins.length < 2) {
                                                    return state.pins.length;
                                                }
                                    
                                                let minDistance = Infinity;
                                                let bestIndex = state.pins.length;
                                    
                                                for (let i = 0; i < state.pins.length - 1; i++) {
                                                    const p1 = state.pins[i];
                                                    const p2 = state.pins[i + 1];
                                    
                                                    // Midpoint approximation
                                                    const midPoint = new maptilersdk.LngLat((p1.lng + p2.lng) / 2, (p1.lat + p2.lat) / 2);
                                                    const distance = haversineDistanceObjects(newLatLng, midPoint);
                    
                                                    if (distance < minDistance) {
                                                        minDistance = distance;
                                                        bestIndex = i + 1; // Insert after p1
                                                    }
                                                }
                                                return bestIndex;
                                            }
                                            
                                            function debounce(func, delay) {            let timeout;
            const debounced = function(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), delay);
            };
            debounced.cancel = () => clearTimeout(timeout);
            return debounced;
        }

        function loadChartJs() {
            return new Promise((resolve, reject) => {
                if (state.isChartJsLoaded) {
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
                script.onload = () => {
                    state.isChartJsLoaded = true;
                    console.log('Chart.js loaded dynamically.');
                    resolve();
                };
                script.onerror = () => {
                    console.error('Failed to load Chart.js');
                    reject(new Error('Failed to load Chart.js'));
                };
                document.head.appendChild(script);
            });
        }



        function syncCustomToggleButtons() {
            const roundTripButton = document.getElementById('custom-round-trip');
            const roundTripToggle = document.getElementById('roundTripToggle');
            const steepUphillButton = document.getElementById('custom-steep-uphill');
            const steepUphillToggle = document.getElementById('steepUphillToggle');

            if (roundTripButton && roundTripToggle) {
                roundTripButton.classList.toggle('active', roundTripToggle.checked);
            }
            if (steepUphillButton && steepUphillToggle) {
                steepUphillButton.classList.toggle('active', steepUphillToggle.checked);
            }
        }

        function showLoading(show) {
            document.getElementById('topRightLoader').classList.toggle('hidden', !show);
        }
        
        function showMessage(message, type = 'error') {
            const el = document.getElementById('messageOverlay');
            document.getElementById('messageText').textContent = message;
            
            el.className = 'absolute top-24 left-1/2 transform -translate-x-1/2 px-4 py-3 rounded-md shadow-lg z-[4000]';
            if (type === 'error') {
                el.classList.add('bg-red-100', 'border', 'border-red-400', 'text-red-700');
            } else { // success
                el.classList.add('bg-green-100', 'border', 'border-green-400', 'text-green-700');
            }

            el.style.display = 'block';
            el.classList.remove('message-fade');
            setTimeout(() => el.classList.add('message-fade'), 4500);
        }
        
        function updateUIState() {
            const hasPins = state.pins.length > 0;
            const hasRoute = state.pins.length >= 2;
            
            document.getElementById('instructions').style.display = hasPins ? 'none' : 'block';
            document.getElementById('downloadGPX').style.display = hasRoute ? 'flex' : 'none';
            document.getElementById('recalculateRoute').disabled = !hasRoute;
            document.getElementById('downloadPDF').style.display = hasRoute ? 'flex' : 'none';
            document.getElementById('shareButton').disabled = !hasPins;
            showPanelButton.classList.toggle('hidden', !hasRoute || bottomPanel.classList.contains('is-visible'));
            updateUndoButton();
        }
        
        function updateUndoButton() {
            document.getElementById('undoButton').disabled = state.historyIndex <= 0;
        }

        function updateStatsVisibility(show) {
            document.getElementById('stats-content').classList.toggle('hidden', !show);
            document.getElementById('no-stats-message').classList.toggle('hidden', show);
        }
    
