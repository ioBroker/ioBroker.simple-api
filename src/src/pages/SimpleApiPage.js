import React, { useState } from 'react'
import packageIcon from '../images/simple-api.png'
import le from '../images/le.png'
import useInput from '../hooks/input.hook'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCommentDots, faDownload, faSave, faShareSquare, faTimes, faUpload } from '@fortawesome/free-solid-svg-icons'
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    FormControlLabel,
    Button,
    Checkbox
} from '@mui/material'

const SimpleApiPage = () => {

    const iconProps = {
        color: "white",
        size: "1x"
    }
    const iconProps2 = {
        color: "blue",
        size: "lg"
    }

    const webAdapter = useInput('Никто')
    const ip = useInput('[IPv6] ::1 - Loopback Pseudo-Interface 1')
    const port = useInput('8087')
    const admin = useInput('Admin')
    const dataSource = useInput('Никто')
    const auth = useInput(false)

    const publicCert = useInput('Никто')
    const privateCert = useInput('Никто')
    const chainedCert = useInput('Никто')
    const dnsPort = useInput('80')


    const [encryption, setEncryption] = useState(false)
    const [usingEncryption, setUsingEncryption] = useState(false)
    const [updateCerts, setUpdateCerts] = useState(false)
    const [tab, setTab] = useState('first')
    const encrypt = () => setEncryption(!encryption)
    const toggleTab = val => setTab(val)
    const usingEncrypt = () => setUsingEncryption(!usingEncryption)
    const updateCertsFunction = () => setUpdateCerts(!updateCerts)

    return (
        <div className="package">
            <div className="package-settings">
                <h4 className="package-settings__header">
                    Настройки драйвера: simple-api.1
                </h4>
                <div className="package-settings--tabs">
                    <Button variant="text" onClick={() => toggleTab('first')} className={`package-settings--tabs__item ${tab === 'first' && 'active'}`}>
                        Основные настройки
                    </Button>
                    <Button variant="text" onClick={() => toggleTab('second')} className={`package-settings--tabs__item ${tab === 'second' && 'active'}`}>
                        LET'S ENCRYPT СЕРТИФИКАТ
                    </Button>
                </div>
            </div>
            <div className="package-body">
                {
                    tab === 'first' ?
                        <>
                            <div className="package-body--panel">
                                <div className="package-body--panel__icon">
                                    <img src={packageIcon} alt="Package Icon" />
                                </div>
                                <div className="package-body--panel__actions">
                                    <span>
                                        <FontAwesomeIcon {...iconProps} icon={faCommentDots} />
                                    </span>
                                    <span>
                                        <FontAwesomeIcon {...iconProps} icon={faUpload} />
                                    </span>
                                    <span>
                                        <FontAwesomeIcon {...iconProps} icon={faDownload} />
                                    </span>
                                </div>
                            </div>
                            <div className="package-body--settings">
                                <div className="package-body--settings__item">
                                    <FormControl variant="standard" sx={{ m: 1, minWidth: 400 }}>
                                        <InputLabel id="web-adapter">Веб-адаптер</InputLabel>
                                        <Select
                                            labelId="web-adapter"
                                            label="Веб-адаптер"
                                            {...webAdapter}
                                            required={true}
                                        >
                                            <MenuItem value="Никто">
                                                Никто
                                            </MenuItem>
                                            <MenuItem value="Все">
                                                Все
                                            </MenuItem>
                                        </Select>
                                        <p className="secondary">Расширять веб-адаптер</p>
                                    </FormControl>
                                </div>
                                <div className="package-body--settings__item">
                                    <FormControl variant="standard" sx={{ m: 1, minWidth: 400 }}>
                                        <InputLabel id="ip">IP</InputLabel>
                                        <Select
                                            labelId="ip"
                                            label="Веб-адаптер"
                                            {...ip}
                                            required={true}
                                        >
                                            <MenuItem value="[IPv4] 0.0.0.0 - Открыть для всех IP адресов">
                                                [IPv4] 0.0.0.0 - Открыть для всех IP адресов
                                            </MenuItem>
                                            <MenuItem value="[IPv4] 10.101.10.139 - Беспроводная сеть">
                                                [IPv4] 10.101.10.139 - Беспроводная сеть
                                            </MenuItem>
                                            <MenuItem value="[IPv4] 127.0.0.1 - Loopback Pseudo-Interface 1">
                                                [IPv4] 127.0.0.1 - Loopback Pseudo-Interface 1
                                            </MenuItem>
                                            <MenuItem value="[IPv6] ::">
                                                [IPv6] ::
                                            </MenuItem>
                                            <MenuItem value="[IPv6] fe80::95f:64cd:c535:784f - Беспроводная сеть">
                                                [IPv6] fe80::95f:64cd:c535:784f - Беспроводная сеть
                                            </MenuItem>
                                            <MenuItem value="[IPv6] ::1 - Loopback Pseudo-Interface 1">
                                                [IPv6] ::1 - Loopback Pseudo-Interface 1
                                            </MenuItem>
                                        </Select>
                                        <p className="secondary">IP</p>
                                    </FormControl>
                                    <FormControl variant="standard" sx={{ m: 1, minWidth: 150 }}>
                                        <TextField
                                            label="Порт"
                                            variant="standard"
                                            {...port}
                                        />
                                        <p className="secondary">IP</p>
                                    </FormControl>
                                </div>
                                <div className="package-body--settings__item">
                                    <FormControlLabel control={<Checkbox />} checked={encryption} onChange={encrypt} label="Шифрование (HTTPS)" />
                                    {
                                        encryption &&
                                        <div>
                                            <FormControl variant="standard" sx={{ m: 1, minWidth: 200 }}>
                                                <InputLabel id="publicCert">'Public' сертификат</InputLabel>
                                                <Select
                                                    labelId="publicCert"
                                                    label="'Public' сертификат"
                                                    {...publicCert}
                                                    required={true}
                                                >
                                                    <MenuItem value="Никто">
                                                        Никто
                                                    </MenuItem>
                                                    <MenuItem value="defaultPublic">
                                                        defaultPublic
                                                    </MenuItem>
                                                </Select>
                                                <p className="secondary">'Public' сертификат</p>
                                            </FormControl>
                                            <FormControl variant="standard" sx={{ m: 1, minWidth: 200 }}>
                                                <InputLabel id="web-adapter">'Private' сертификат</InputLabel>
                                                <Select
                                                    labelId="web-adapter"
                                                    label="'Private' сертификат"
                                                    {...privateCert}
                                                    required={true}
                                                >
                                                    <MenuItem value="Никто">
                                                        Никто
                                                    </MenuItem>
                                                    <MenuItem value="defaultPrivate">
                                                        defaultPrivate
                                                    </MenuItem>
                                                </Select>
                                                <p className="secondary">'Private' сертификат</p>
                                            </FormControl>
                                            <FormControl variant="standard" sx={{ m: 1, minWidth: 200 }}>
                                                <InputLabel id="web-adapter">'Chained' сертификат</InputLabel>
                                                <Select
                                                    labelId="web-adapter"
                                                    label="'Chained' сертификат"
                                                    {...chainedCert}
                                                    required={true}
                                                >
                                                    <MenuItem value="Никто">
                                                        Никто
                                                    </MenuItem>
                                                </Select>
                                                <p className="secondary">'Chained' сертификат</p>
                                            </FormControl>
                                        </div>
                                    }
                                </div>
                                <div className="package-body--settings__item">
                                    <FormControlLabel control={<Checkbox />} {...auth} label="Аутентификация" />
                                </div>
                                <div className="package-body--settings__item">
                                    <FormControl variant="standard" sx={{ m: 1, minWidth: 400 }}>
                                        <InputLabel id="admin">Администратор</InputLabel>
                                        <Select
                                            labelId="admin"
                                            label="Администратор"
                                            {...admin}
                                            required={true}
                                        >
                                            <MenuItem value="Admin">
                                                Admin
                                            </MenuItem>
                                        </Select>
                                        <p className="secondary">Запустить от пользователя</p>
                                    </FormControl>
                                    <FormControlLabel control={<Checkbox />} label="Разрешить только когда пользователь является владельцем" />
                                </div>
                                <div className="package-body--settings__item">
                                    <FormControl variant="standard" sx={{ m: 1, minWidth: 400 }}>
                                        <InputLabel id="dataSource">Источник данных</InputLabel>
                                        <Select
                                            labelId="dataSource"
                                            label="Источник данных"
                                            {...dataSource}
                                            required={true}
                                        >
                                            <MenuItem value="Никто">
                                                Никто
                                            </MenuItem>
                                        </Select>
                                        <p className="secondary">Выберите источник данных</p>
                                    </FormControl>
                                    <FormControlLabel control={<Checkbox />} label="Список всех точек данных" />
                                </div>
                            </div>
                        </> :
                        <>
                            <div className="package-body--panel">
                                <div className="package-body--panel__icon2">
                                    <img src={le} alt="Let's encrypt" />
                                </div>
                            </div>
                            <div className="package-body--settings">
                                <div className="package-body--settings__item extra">
                                    <FormControlLabel control={<Checkbox />} checked={usingEncryption} onChange={usingEncrypt} label="Использовать сертификаты Let's Encrypt" />
                                    <FontAwesomeIcon {...iconProps2} icon={faCommentDots} />
                                </div>
                                {
                                    usingEncryption &&
                                    <div className="package-body--settings__item extra">
                                        <FormControlLabel control={<Checkbox />} checked={updateCerts} onChange={updateCertsFunction} label="Обновлять сертификаты в этом драйвере" />
                                        <FontAwesomeIcon {...iconProps2} icon={faCommentDots} />
                                    </div>
                                }
                                {
                                    usingEncryption && updateCerts &&
                                    <div className="package-body--settings__item extra last">
                                        <FormControl variant="standard" sx={{ m: 1, minWidth: 150 }}>
                                            <TextField
                                                label="Порт для проверки доменного имени"
                                                variant="standard"
                                                type="number"
                                                {...dnsPort}
                                            />
                                            <p className="secondary">Порт для проверки доменного имени</p>
                                        </FormControl>
                                        <FontAwesomeIcon {...iconProps2} icon={faCommentDots} />
                                    </div>
                                }
                            </div>
                        </>
                }
            </div>
            <div className="package-actions">
                <div className="package-actions--positive">
                    <Button startIcon={<FontAwesomeIcon icon={faSave} />} variant="contained">Сохранить</Button>
                    <Button startIcon={<FontAwesomeIcon icon={faShareSquare} />} variant="contained">Сохранить и выйти</Button>
                </div>
                <div className="package-actions--negative">
                    <Button startIcon={<FontAwesomeIcon icon={faTimes} />} variant="contained">Отмена</Button>
                </div>
            </div>
        </div>
    )
}

export default SimpleApiPage